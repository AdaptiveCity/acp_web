"use strict"

const DEFAULT_REZ = 5;
const HIGH_REZ = 3;
const LOW_REZ = 8;

class HeatMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        let self = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        self.master = floorspace;

        //declare the url to request data from
        self.query_url = "https://cdbb.uk/api/readings/get_floor_feature/";

        // Instatiante an RTmonitor class
        self.rt_con = new RTconnect(self);

        //a set of useful d3 functions
        self.jb_tools = new VizTools2();

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//
        self.setup_buttons(self);

    }

    //TODO: add more buttons from the heatmaps class rather than floor
    setup_buttons(self) {
        try {
            //Set up event listener for the HEATMAP BUTTON
            document.getElementById('show_rain').addEventListener('click', () => {

                //init the heatmap
                self.init(self);

                //first reset the drawn floorplan to it's original location
                self.master.manage_zoom.reset(self);
            })
        } catch (error) {
            console.log(error, 'no button present - heatmap not available')
        }

    }

    // init() called when page loaded
    init(parent) {
        //----------------------------------//
        //-----declare object globals-------//
        //----------------------------------//

        //sensor data+location required to draw the heatmap
        parent.sensor_data = {};

        //sensor data saved per crate
        parent.crates_with_sensors = {};

        //declare the min max range of values for temp/co2/humidity - will change during runtime
        parent.min_max_range = {};

        //resolution
        parent.rect_size = DEFAULT_REZ;

        //declare the main colorscheme for the heatmap
        parent.color_scheme = d3.scaleSequential(d3.interpolateInferno)

        //total time to draw transitions between activating the heatmap
        parent.animation_dur = 350;

        //separate aniamtion to see how long the 'raindrop' remains visible
        parent.splash_dur = 400; //WAS 200
        parent.ripple_dur = 4500;

        //make a global c_conf reference from the parent class
        //CREATES A COLORBAR
        parent.c_conf = parent.jb_tools.canvas_conf(110, 320, 10, 10, 10, 10); //(110, 320, 10, 5, 10, 5);

        //the delay for drawing individual items during the animation
        parent.animation_delay = d3.scaleLinear().range([3000, 1000]);

        parent.msg_queue = [];

        //heatmap opacity
        parent.default_opacity = 0.75;
        parent.sensor_opacity = parent.master.sensor_opacity;

        //set div id's show status change upon connect
        parent.txt_div_id = 'rain_rt';
        parent.status_div_id = 'rain_rt_state'
        parent.timer_short; //the socket has been unactive for a while -- color yellow
        parent.timer_long; //assume the socket connection was lost -- color red

        parent.startup = true;
        parent.sensor_rect_dist = {}

        //Use get_floor_sensors for the API calls, get_local_sensors for faked offline data
        parent.get_floor_sensors(parent);
        //parent.get_local_sensors(parent);

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS-2------//
        //--------------------------------------//

        //connect to rt monitor
        document.getElementById('rain_rt_connect').addEventListener('click', () => {
            parent.disconnect_rt(parent)
        });

        //Set up event listener to hide the HEATMAP
        document.getElementById('reset').addEventListener('click', () => {
            parent.hide_heatmap(parent);
        });

        //attach an event listener to the list of properties
        document.getElementById('features_list').addEventListener('change', function () {
            console.log('You selected: ', this.value);
            parent.redraw_heatmap(parent, this.value)
        });

        //attach an event listener to change the heatmap resolution
        document.getElementById('resolution_list').addEventListener('change', function () {
            console.log('You selected: ', this.value);
            parent.update_resolution(parent, this.value);
        });

    }
    //connects to the rt monitor via websockets
    connect_rt(parent) {
        //get a list of all sensors rendered on screen
        parent.sub_list = Object.keys(parent.master.sensor_data);
        //console.log('sensors', parent.sub_list)
        //do rtmonitor connect, telling which sensors to subscribe to
        parent.rt_con.connect(parent.check_status.bind(parent), parent.sub_list);
    }

    //disconnects rt monitor to stop splashes
    disconnect_rt(parent) {
        //disconnect the socket:
        parent.rt_con.do_disconnect(parent.rt_con);

        //change button colors/innerHTML
        document.getElementById(parent.txt_div_id).innerHTML = 'RTm disconnected';
        document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(255, 50, 50)';

        //clear all timers
        clearTimeout(parent.timer_short);
        clearTimeout(parent.timer_long);
    }

    //updates the rtmonitor status icon on the page
    check_status(value, msg) {
        let parent = this; //reference to the heatmap self object

        console.log('returned', value, parent)

        switch (value) {
            //RealTime monitor connection successful
            case '1':
                document.getElementById(parent.txt_div_id).innerHTML = 'RTm Connected';
                document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(108, 255, 150)';
                break;

                //Message successfully received
            case '2':
                //MESSAGE RECEIVED, updates data structures
                try {
                    //sensor_data[sensor_id]=msg.value
                    //do animation
                    let msg_data = msg;
                    console.log('value received', value, msg_data)

                    //send not only acp_id but an entire msg 
                    console.log('updating sensor data structs')
                    parent.update_sensor_data(parent, msg_data);

                    //check if the new message only contains a "motion" trigger event
                    let motion_trigger = false;
                    let cooked = msg_data.payload_cooked;
                    //if payload_cooked only has a single key and it is 'motion' or 'occupancy'
                    // (usually paired though) then we now 
                    //it's an interrupt triggered motion event
                    if ((Object.keys(cooked).length < 3) && (("motion" in cooked) || ("occupancy" in cooked))) {
                        console.log('motion-only event detected', msg_data)
                        motion_trigger = true;
                    }

                    //Draw a splash event on screen
                    parent.draw_splash(parent, msg_data.acp_id, motion_trigger)

                } catch (err) {
                    console.log('something went wrong', err)
                    console.log('msg received:', msg)
                }

                //clear the previous timer since last message
                clearTimeout(parent.timer_short);
                clearTimeout(parent.timer_long);

                //set a short timer to know how long the messages haven't been coming in for
                parent.timer_short = setTimeout(function () {

                    console.log('no messages for 5mins', new Date())
                    document.getElementById(parent.txt_div_id).innerHTML = 'RTm unresponsive';
                    document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(255, 255, 50)';

                }, 1000 * 60 * 5); //5mins

                //set a long timer to assume that the socket has been dropped
                parent.timer_long = setTimeout(function () {

                    console.log('no messages for 15mins', new Date())
                    document.getElementById(parent.txt_div_id).innerHTML = 'RTm failed';
                    document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(255, 50, 50)';

                }, 1000 * 60 * 15); //15mins

                break;

            default:
                break;
        }
    }

    //-----------------------//
    //Generates the heatmap--//
    //-----------------------//

    //It is attached to an event listener on the template *heatmap* button 
    show_heatmap(parent) {
        //stop drawn floorplan polygons from interacting with the heatmap overlay
        d3.selectAll('polygon').attr('pointer-events', 'none');

        parent.show_heatmap_original(parent)
        //parent.show_heatmap_alt(parent)
    }
    //-------------------------------------------------//
    //Reloads the heatmap with a different resolution--//
    //-------------------------------------------------//

    update_resolution(parent, rez_value) {
        //remove current heatmap
        d3.selectAll('#heatmap').remove();
        //remove redrawn sensors
        d3.selectAll('#heatmap_sensors').remove();

        //change the resolution
        switch (rez_value) {
            case 'regular':
                parent.rect_size = DEFAULT_REZ;
                break;
            case 'high':
                parent.rect_size = HIGH_REZ;
                break;
            case 'low':
                parent.rect_size = LOW_REZ;
                break;
            default:
                parent.rect_size = DEFAULT_REZ;
                break;
        }

        //first reset the drawn floorplan to it's original location
        parent.master.manage_zoom.reset(parent.master);

        //load the new heatmap
        parent.show_heatmap(parent);

        //update tooltips
        parent.master.jb_tools.tooltips();
    }

    make_sublayers() {
        let cloned_layer = d3.select('#heatmap')
            .clone(true)
            .attr('id', 'heatmap_splashes')
            .attr('pointer-events', 'none')
            .selectAll('g')
            .attr('id', function (d, i) {
                return d3.select(this).attr("id") + '_splash'
            })
            .attr('class', function (d, i) {
                return d3.select(this).attr("class") + '_splash'
            })
            .selectAll('rect')
            // .attr('id', function (d, i) {
            //     return d3.select(this).attr("id") + '_splash'
            // })
            .style('opacity', 0)
            .style('fill', 'white')
            .attr('class', function (d, i) {
                return d3.select(this).attr("class") + '_splash'
            })

    }

    animation_ticker(parent) {
        let interval_step = 100;
        let total_duration = 4000;
        let final_step = total_duration / interval_step;

        parent.interval_timer = setInterval(function () {

            if (parent.msg_queue.length < 1) {
                return
            }
            for (let i = 0; i < parent.msg_queue.length; i++) {

                let element = parent.msg_queue[i];
                let heatmap_crate_id = element.crate_id;
                let acp_id = element.acp_id;


                //run the final animation frame routine
                if (final_step - element.state <= 1) {

                    //remove the message from the queue
                    parent.msg_queue.splice(i, 1);

                    //print the number of animations currently running
                    console.log('current_backstack ', parent.msg_queue.length)

                    //check that no messages queued for the crate first
                    let msg_left = parent.msg_queue.find(
                        el => {
                            if (el.crate_id == heatmap_crate_id) {
                                return true
                            }
                            return false
                        }
                    )

                    //if no messages left in a crate, we can slowly fade out the splash layer
                    if (!msg_left) {
                        console.log('empty queue for ', heatmap_crate_id)
                        d3.select('#' + heatmap_crate_id + '_heatmap_splash')
                            .selectAll('rect')
                            .transition()
                            .duration(500)
                            .style('opacity', 0)
                            .on('interrupt', function () {
                                d3.select(this).attr('opacity', 0);
                            })
                    }
                    //skip to the next loop iteration
                    continue
                }
                //else run the regular frame routine

                let iterator = 0;//check the c

                let dist_value;
                try {
                    dist_value = parent.sensor_rect_dist[heatmap_crate_id][acp_id];

                } catch (error) {
                    //not sure about this step
                    //what would the remaining rects look like?
                    parent.msg_queue.splice(i, 1);
                    element.state++;
                    continue
                }


                //track the animation progres
                let current_state = element.state / final_step;

                //get all cells in a crate we want to update
                let crate_cells = d3.selectAll('.' + heatmap_crate_id + '_rect_splash').nodes();

                //iterate over the cells in crate
                crate_cells.forEach(function (cell, index) {

                    //select a cell
                    let selected_cell = d3.select(cell);

                    //get its current opacity
                    let current_opacity = parseFloat(selected_cell.style("opacity"));

                    //get the distance from the sensor
                    let actual_dist = dist_value[index] < 20 ? 20 : dist_value[index];
                    let dampening = actual_dist > 30 ? 30 : actual_dist;

                    let final_opacity;
                    let warp_delay;

                    //in the first 10% of animation we draw a splash
                    if (current_state < 0.1) {
                        let splash_dampening = dist_value[index] / 5; //>1.5?1.5:dist_value[index];

                        warp_delay = (((Math.cos(actual_dist / (element.run_state)) + 1))) / splash_dampening;
                        //warp_delay = (((Math.cos(actual_dist / (final_step - element.run_state)) + 1))) / splash_dampening;

                    }
                    //and then draw the ripples
                    else {
                        let amplitude = 6; //how bright the splash is

                        warp_delay = ((((Math.cos(actual_dist / element.run_state) + 1)) * amplitude) / (dampening));
                        //let warp_delay = ((((Math.cos(actual_dist / (run_state + 2)) + 1)) * amplitude) / dampening);
                    }

                    //TODO:decrease amplitude or increase dampening in the last 20 percent of the animation
                    //final opacity for the cell is its previous value +new value multiplied by coefficients
                    final_opacity = (current_opacity * 0.6 + warp_delay * 0.4) /// 2;

                    //limit the total opacity to 90%
                   // final_opacity = final_opacity > 0.9 ? 0.9 : final_opacity

                    //add the calculated opacity to the cell
                    selected_cell.style('opacity', +final_opacity.toFixed(3));

                    //iterator++
                });
                element.state++;

                element.run_state += 0.65;
            }

        }, interval_step);
    }

    do_animation(parent, acp_id) {
        function in_progress(acp_id) {
            parent.msg_queue.find(el => {
                if (el.acp_id == acp_id) {
                    el.state = 0;
                    el.run_state = 1.5;
                    return true
                }
                return false
            })
        }
        let progress_state = in_progress(acp_id)
        // console.log('msg', acp_id, progress_state)

        if (!progress_state) {
            try {
                parent.msg_queue.push({
                    'acp_id': acp_id,
                    'crate_id': parent.sensor_data[acp_id].crate_id,
                    'state': 0,
                    'run_state': 1.5
                }) //id and animation step
                // parent.draw_splash_alt(parent, acp_id, 1) 
            } catch (error) {
                
            }
          
        }

        //TODO - CAN UPDATE THE COLOR ON THE FLY?
        //  todo to do important
        //if WALK (or trigger) we DO NOT WANT TO UPDATE THE CRATE HEATMAP--> a lot of the time the msg only contains "motion":1 
        //change the crate's heatmap by recoloring the cells in based on the new readings
        // parent.update_crate_heatmap(parent, sensor_data.crate_id, acp_id);

    }


    //Main raindrop function for incoming data:
    //selects a sensor and sets it to update on by creating a raindrop
    draw_splash(parent, acp_id, walk) {
        //walks is a bollean parameter that makes a distinction between drawing a big splash or a small one
        //reverse walk (only temporary) //TODO:fix this
        walk != walk;

        //get the data from the sensor data variable
        let sensor_data = parent.sensor_data[acp_id];

        //get drawn sensors' location on screen
        let sensor_loc = {
            x: document.getElementById(acp_id + "_hm").getAttribute("cx"),
            y: document.getElementById(acp_id + "_hm").getAttribute("cy")
        }

        //debug location
        //  console.log('sensorloc:', sensor_loc, acp_id, sensor_data)

        //rects in polygons are classed by the crate they're in
        let rect_class = sensor_data.crate_id + "_rect";

        //select all relevant rects
        d3.selectAll("." + rect_class).nodes().forEach(node => {

            //acquire their position from the HTML data-loc property 
            let raw_loc = node.dataset.loc.split(',')
            let selected_crate = node.dataset.crate; //??? should this be sensor_data.crate_id ??? -- to be changed

            //get rect's location on screen
            let rect_loc = {
                x: node.x.animVal.value,
                y: node.y.animVal.value,
                scale: parseFloat(raw_loc[2])
            }

            //recoloring rects -- I don't think it's how it should be implemented, lots of unnecessary recalcultion -- to be changed
            //e.g. this value should clearly be retrieved using node.dataset property that's already in HTML
            let cell_value = parent.get_cell_value(parent, selected_crate, rect_loc);

            let color = parent.color_scheme(cell_value);

            let dist_delay = parent.jb_tools.dist(rect_loc, sensor_loc);

            let selected_node = d3.select(node);


            //IMPORTANT TODO- ADD INTERUPT CASES TO END ANIMATIONS PREMATURELY
            selected_node
                .style("fill", function (d) {
                    return color
                })

                //HERE BEGINS THE INITIAL SPLASH THAT IS JUST A BIG WHITE BLOB
                //WE MAKE IT SHORT AT FIRST
                .transition() // <------- TRANSITION STARTS HERE --------
                .duration(parent.splash_dur) //250

                .ease(d3.easeExpOut)

                .delay(function (d, i) {

                    let delay = (((Math.cos(dist_delay / 20) + 1)) * 2);

                    // if (delay < 50) {
                    //     delay = 0;
                    // }
                    // console.log('delay', delay, Math.cos(dist_delay), 'dist', dist_delay, loc, sensor_loc)
                    // console.log('delay', delay,dist_delay);

                    if (delay > 1000) {
                        delay = 1000;
                    }
                    return delay
                })
                // .ease(d3.easeCubicIn)

                .style("fill", function (d) {
                    return color //'white'//'white' //color
                })

                .style('opacity', function (d, i) {
                    //let opacity = (((Math.sin(dist_delay / 5) + 1)));

                    let opacity = dist_delay / 100;

                    if (walk) {
                        opacity = dist_delay / 25
                    }
                    //console.log('opacity', opacity,dist_delay);

                    if (opacity > parent.default_opacity) {
                        opacity = parent.default_opacity;
                    }
                    return opacity
                })
                //setup interrupt cases when animationcan get suddenly cancelled by another
                .on("interrupt", function () {
                    selected_node.attr('opacity', parent.default_opacity);
                    selected_node.attr('fill', color);
                })

                .on('end', function (d, i) {
                    selected_node

                        //HERE THE SECOND PART BEGINS WHERE WE SHOW THE RIPPLE
                        .transition() // <------- TRANSITION STARTS HERE --------
                        .duration(function (d, i) {
                            if (walk) {
                                return parent.ripple_dur //TODO ADD A MULTIPLYER
                            } else {
                                return parent.ripple_dur / 2;
                            }
                        })
                        .ease(d3.easeCubicOut)

                        .delay(function (d, i) {

                            let wave_len = 5;
                            let amplitude = 4000;

                            // if (walk) {
                            //     wave_len = 2.5;
                            //     amplitude = 1000;
                            // }
                            //dampening function
                            let warp_delay = (((Math.cos(dist_delay / wave_len) + 1)) * amplitude) / dist_delay;


                            //THESE COMMMENTED OUT BITS HELP REDUCE THE WHITE CELLS 
                            //THAT STAY AFTER THE RIPPLE, THIS IS THE TAIL END
                            //OF THE MATHEMATICAL FUNCTION, SO WE WANT TO JUST CUT IT OFF
                            // console.log('warp delay', warp_delay)
                            //since the funciton follow 
                            // if (warp_delay > 200) {
                            //     warp_delay = 200;
                            //     if (walk) {
                            //         warp_delay = 75;
                            //     }
                            // }
                            // if (warp_delay < 50) {
                            //     warp_delay = 0;

                            // }

                            if (warp_delay > 1000) {
                                warp_delay = 1000;
                            }
                            return warp_delay

                        })

                        .style("fill", function (d) {
                            return color //'red'
                        })
                        .style('opacity', parent.default_opacity)

                        //setup interrupt cases when animation can get suddenly cancelled by another
                        .on("interrupt", function () {


                            selected_node.attr('opacity', parent.default_opacity);
                            selected_node.attr('fill', color);
                        });
                })
        });


        //TODO - CAN UPDATE THE COLOR ON THE FLY?
        //  todo to do important
        //if WALK (or trigger) we DO NOT WANT TO UPDATE THE CRATE HEATMAP--> a lot of the time the msg only contains "motion":1 
        //change the crate's heatmap by recoloring the cells in based on the new readings
        parent.update_crate_heatmap(parent, sensor_data.crate_id, acp_id);
    }

    //API requests to get sensors per crate
    get_floor_sensors(parent) {

        let system = parent.master.floor_coordinate_system;
        let floor = parent.master.floor_number;
        console.log('master', system, floor, parent.master, parent.master['floor_coordinate_system'], parent.master.floor_coordinate_system)
        //passs feature as argument from html list of features
        let feature = document.getElementById('features_list').value;

        let readings_url = parent.query_url + system + "/" + floor + "/" + feature + "/" + "?metadata=true";
        console.log('heatmap url', readings_url, feature)

        //query the url to get all of the sensors on the floor
        d3.json(readings_url, {
            crossOrigin: "anonymous"
        }).then(function (received_data) {
            console.log('heatmap received', received_data)
            parent.handle_sensors_metadata(parent, received_data)

            //-----------------------------------//
            //---generate and show the heatmap---//
            //-----------------------------------//
            parent.show_heatmap(parent);
            parent.master.jb_tools.tooltips();

            //connect rt_monitor automatically
            parent.connect_rt(parent)

        });

    }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, results) {

        console.log("handle_sensors_metadata() loaded", results);

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in results['sensors']) {

            //console.log('sensor', sensor, results['sensors'][sensor])
            // Note jsonPath always returns a list of result, or false if path not found.
            //let path_val = jsonPath(d, feature['jsonpath']); //d.payload_cooked.temperature;
            //TODO USE JSONPATH
            try {
                let sensor_type = results['sensors'][sensor]['acp_type_id']
                parent.sensor_data[sensor] = {
                    'acp_id': sensor,
                    'location': results['sensors'][sensor].acp_location_xyz,
                    'crate_id': results['sensors'][sensor].crate_id,
                    'payload': results['readings'][sensor].payload_cooked, // change with jsonPath -- charts.js example
                    'features': results['sensor_types'][sensor_type].features,
                    'acp_ts': results['readings'][sensor].acp_ts
                }

                if (parent.crates_with_sensors[results['sensors'][sensor].crate_id] == undefined) {
                    parent.crates_with_sensors[results['sensors'][sensor].crate_id] = [];
                    parent.crates_with_sensors[results['sensors'][sensor].crate_id].push({
                        'acp_id': sensor,
                        'payload': results['readings'][sensor].payload_cooked
                    });
                } else {
                    parent.crates_with_sensors[results['sensors'][sensor].crate_id].push({
                            'acp_id': sensor,
                            'payload': results['readings'][sensor].payload_cooked
                        }

                    );
                }


            } catch (error) {
                console.log('sensor not found:', sensor, '\n', error)
            }
        }
        console.log('crates w sensors', parent.crates_with_sensors)
    }

    update_sensor_data(parent, msg) {
        //msg contains acp_id, acp_ts and payload_cooked
        try {
            let acp_id = msg.acp_id;
            let new_acp_ts = msg.acp_ts;
            let new_payload = msg.payload_cooked;

            parent.sensor_data[acp_id].acp_ts = new_acp_ts;
            //here we take into account that sensor's payload can have only one or multiple updates to features
            //e.g. the new data packet can only have motion=1, w/out updates for other features, hence we can't
            //just wipe the rest of the data by overwriting the entire payload_cooked property in the data struct

            console.log('pre', parent.sensor_data[acp_id].payload)
            for (let feature in new_payload) {
                console.log('new', feature, 'is', new_payload[feature], 'was', parent.sensor_data[acp_id].payload[feature])

                parent.sensor_data[acp_id].payload[feature] = new_payload[feature];
            }
            console.log('post', parent.sensor_data[acp_id].payload)


        } catch (error) {
            console.log('failed to update the data struct with payloads', error)
            console.log('msg received:', msg)
        }

    }

    update_crate_heatmap(parent, crate_id, sensor_id) {
        //select the rectangles associated with a selected crate
        let class_id = crate_id + "_rect";

        d3.selectAll("." + class_id).nodes().forEach(rect => {

            //acquire their position from the HTML data-loc property 
            let raw_loc = rect.dataset.loc.split(',')
            let selected_crate = rect.dataset.crate; //??? should this be sensor_data.crate_id ??? -- to be changed

            //get rect's location on screen
            let rect_loc = {
                x: parseFloat(raw_loc[0]),
                y: parseFloat(raw_loc[1]),
                scale: parseFloat(raw_loc[2])
            }

            //--------------------------------------------//
            //--Uncomment bellow to fake sensor readings--//
            //--------------------------------------------//

            /*
             let temp_val = Math.random() * (3 + 3) - 3;
             let current_val = parent.sensor_data[sensor_id].payload.temperature;
             let new_val = temp_val + current_val;

             if (new_val > 40 || new_val < -10) {
                 new_val = current_val;
             }

            //update the reading with a new rand value
            parent.sensor_data[sensor_id].payload.temperature = new_val;
            */

            //--------------------------------------------//
            //------------End of the subsegment-----------//
            //--------------------------------------------//

            //recalculate the rect value based on the new feature
            let cell_value = parent.get_cell_value(parent, selected_crate, rect_loc);

            //transform the feature value into a color
            let color = parent.color_scheme(cell_value);

            let feature = document.getElementById('features_list').value;

            //update the rect on screen
            d3.select(rect)
                .attr('data-crate', selected_crate)
                .attr('data-loc', [rect_loc.x, rect_loc.y, rect_loc.scale])
                .attr('data-type', feature)
                .attr('data-value', cell_value)
                .on("mouseover", function (d) {
                    parent.set_cbar_value(parent, cell_value)
                })
                .on("mouseout", function (d) {
                    d3.select('#hover_val').remove();
                })
                .style("fill", function (d) {
                    return color
                })
        })
    }


    //redraw heatmap based on a selected feature
    redraw_heatmap(parent, feature) {

        //get min/max for the selected feature
        parent.get_min_max(parent, feature)
        //reset the colorbar
        parent.set_colorbar(parent);

        //iterate through all crates that have sensors in them
        Object.keys(parent.crates_with_sensors).forEach(crate_id => {

            //select the rectangles associated with a selected crate
            let class_id = crate_id + "_rect";

            d3.selectAll("." + class_id).nodes().forEach(rect => {

                //acquire their position from the HTML data-loc property 
                let raw_loc = rect.dataset.loc.split(',')
                let selected_crate = rect.dataset.crate; //??? should this be sensor_data.crate_id ??? -- to be changed

                //get rect's location on screen
                let rect_loc = {
                    x: parseFloat(raw_loc[0]),
                    y: parseFloat(raw_loc[1]),
                    scale: parseFloat(raw_loc[2])
                }

                //recalculate the rect value based on the new feature
                let cell_value = parent.get_cell_value(parent, selected_crate, rect_loc);

                //transform the feature value into a color
                let color = parent.color_scheme(cell_value);

                //update the rect on screen
                d3.select(rect)
                    .attr('data-crate', selected_crate)
                    .attr('data-loc', [rect_loc.x, rect_loc.y, rect_loc.scale])
                    .attr('data-type', feature)
                    .attr('data-value', cell_value)
                    .on("mouseover", function (d) {
                        parent.set_cbar_value(parent, cell_value)
                    })
                    .on("mouseout", function (d) {
                        d3.select('#hover_val').remove();
                    })
                    .style('opacity', 0)
                    .transition() // <------- TRANSITION STARTS HERE --------
                    .delay(function (d, i) {
                        let delay = parent.animation_delay(cell_value);
                        return delay;
                    })
                    .duration(parent.animation_dur)
                    .style("fill", function (d) {
                        return color
                    })
                    .style('opacity', parent.default_opacity)
            })
        })
    }
    //----------------------------------------------------------------//
    //----------------------HEATMAP CALCULATIONS----------------------//
    //----------------------------------------------------------------//


    //calculate the color value of a heatmap cell
    //takes in the crate and coordinates of a cell as arguments
    get_cell_value(parent, crate, coords) {

        //select on of the features (co2, temperature, humidity etc)
        //TODO:user URL
        let feature = document.getElementById('features_list').value;

        //get cell's coordinates and scale
        let rect_loc = coords;
        let scale = coords.scale

        //variable used to calculate cumulative distance from a cell to all sensors around it
        let combined_dist = 0;

        //a list that will contain all crates' sensors and their values
        let sensor_data_points = [];
        //an object with sensor's location embedded in it
        let sensor_loc = {};

        //iterate through all sensors in crates that have sensors
        parent.crates_with_sensors[crate].forEach(sensor => {

            //if the sensor does not have the requested feature (e.g. co2), skip it
            if (sensor.payload[feature] == undefined) {
                return 0
            }

            //get sensor's location
            let x_value = parent.sensor_data[sensor.acp_id]['location']['x'];
            let y_value = -parent.sensor_data[sensor.acp_id]['location']['y'];

            //pass the location to the sensor_loc object and adjust the scale for rendering
            //+add the offset from the svg matrix transformation


            sensor_loc = {
                x: x_value * scale + parent.consolidated_svg.x_off,
                y: y_value * scale + parent.consolidated_svg.y_off
            };

            //get the distance from the sensor_loc to the cell (rect) location
            let dist = parent.jb_tools.dist(sensor_loc, rect_loc)

            //push the sensor to the list of sensors used for the calculation of the cell (rect) color value
            sensor_data_points.push({
                'sensor': sensor.acp_id,
                'value': sensor.payload[feature],
                'dist': dist
            });

            //test for splashes
            if (parent.startup) {
                //console.log('undefined',parent.sensor_rect_dist[crate])
                if (parent.sensor_rect_dist[crate] == undefined) {
                    parent.sensor_rect_dist[crate] = {}
                }
                if (parent.sensor_rect_dist[crate][sensor.acp_id] == undefined) {
                    parent.sensor_rect_dist[crate][sensor.acp_id] = []
                }

                //let warp_delay = ((((Math.cos(dist_value[iterator] / (int_count - interval_count)) + 1)) * amplitude) / dist_value[iterator]);

                parent.sensor_rect_dist[crate][sensor.acp_id].push(dist)
            }

            //add the distance from the cell to the sensor to the cumulative distance  variable
            //(keeps track of the total distance from the cell to all sensors)
            combined_dist += dist;
        })

        //declare the variable for the color; i.e. final value calculated by the coefficients
        let final_val = 0;

        //declare the coefficients used in the function to calculate the color value
        let C = 0;
        let D = 0;

        //magic happens here;
        //We iterate through all the sensors in the crate and try to calculate how to weigh
        //their reading values in a spatial context.
        sensor_data_points.forEach(sensor_point => {

            //check that the sensor is not the only sensor in the room
            if (sensor_point.dist != combined_dist) {

                let B = 0;

                //second loop because we're calculating the inverse spread of sensor readings;
                //e.g. sensor A is 95% of the total distance (TD) away from cell (far), whereas sensor B is 5% of the total distance away (close);
                //TD is dist(sensorA, cell_location)+dist(sensorB, cell_location);
                //following from this, we can't calculate that cell_value = 0.95*valueA(from sensorA)+0.05*valueB, because the the coefficient for
                //sensorB readings has to be higher because it is closer! For this reason, we have to run  a second loop to calculate the reverse.
                sensor_data_points.forEach(sensor_point_alt => {
                    B += combined_dist / sensor_point_alt.dist;
                });

                //calculate the inverse coefficient from the distance
                let A = combined_dist / sensor_point.dist;

                //multiply the coefficient with the sensor reading value, multiplying the sensor's reading by its relative distance coefficient
                C = A * (1 / B) * sensor_point.value;

                //add that sensor's calculated input to the total sum value for the cell
                D += C;

            } else {
                //if a crate has a single sensor, then only use that sensor's reading a the only value
                final_val = sensor_point.value;
            }

        })
        //return the final result after making sure the calculation were right (hence 0 if crate had no sensors)
        return D == 0 ? final_val : D;
        //DEBUG (randomised color) myColor(Math.floor(Math.random()*100))
    }


    //used when generating the heatmap for the first time (not redrawing)
    show_heatmap_original(parent) {
        console.log('start', Date.now())

        let selected_feature = document.getElementById('features_list').value;
        parent.get_min_max(parent, selected_feature);

        //make all polygons white so the underlying color does not interfere with the heatmap
        d3.selectAll('polygon').attr('class', 'g0-9')

        //target the drawing_svg and append a sublayer for the heatmap
        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.master.page_floor_svg.clientHeight;
        let w = parent.master.page_floor_svg.clientWidth;

        //we check for the invisible floor element since it has necessary svg information required to draw the heatmap
        let floor = document.querySelector("[data-crate_type='floor']");

        //!!!-----------IMPORTANT--------------!!//
        //This is actually an intergral part of how we show the heatamp:
        //at first I barely used it but for some reasong the  lockdown lab's heatmap would get offset
        //on x/y axes, so the consolidate() funciton determines the offset (in most cases it's 0)
        //and draws the heatmap overlayed over the floorplan

        //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
        let scale = floor.getCTM().a; //.transform.baseVal.consolidate().matrix.a;
        let x_offset = floor.getCTM().e; //.transform.baseVal.consolidate().matrix.e;
        let y_offset = floor.getCTM().f; //.transform.baseVal.consolidate().matrix.f;

        let consolidated_svg = {
            scale: scale,
            x_off: x_offset,
            y_off: y_offset
        }

        parent.consolidated_svg = consolidated_svg;
        //-----------------END-------------------//

        let counter = 0;
        let crates_with_sensors_list = Object.keys(parent.crates_with_sensors);

        let rect_count = 0;

        //iterate through a list of polygons aka rooms and fill them with individual heatmaps
        d3.selectAll('polygon').nodes().forEach(element => {
            // let bbox = element.getBoundingClientRect();
            let has_sensors = crates_with_sensors_list.includes(element.id);
            if (element.dataset.crate_type != 'building' && element.dataset.crate_type != 'floor' && has_sensors) {
                let class_name = element.id + '_rect';

                let bbox = element.getBBox();

                let polygon_points = element.points;

                let pol_h = bbox.height * scale;
                let pol_w = bbox.width * scale;
                let pol_top = bbox.y * scale;
                let pol_left = bbox.x * scale;

                let offset = 0;

                //create a parent div for all crate lvl heatmaps
                let crate_div = main_svg.append('g').attr('id', element.id + '_heatmap').attr('class', 'heatmap_crates')

                counter++;
                //iterate throught rows and columns and fill in the selected polygon with rectangles representing heatmap cells
                for (let i = pol_left; i < pol_w + pol_left; i += parent.rect_size) {
                    for (let u = pol_top; u < pol_h + pol_top; u += parent.rect_size) {

                        rect_count++;

                        let coords = {
                            'x': i / scale,
                            'y': u / scale,
                            'height': h,
                            'width': w
                        };

                        if (parent.jb_tools.inside(coords, polygon_points)) {

                            let selected_crate = element.id;

                            //get the location data + an offset so that the reactangle's coords are in the middle
                            let loc = {
                                x: ((i - parent.rect_size / 2) + x_offset).toFixed(1), //round
                                y: ((u - parent.rect_size / 2) + y_offset).toFixed(1), //round
                                cons_svg: consolidated_svg,
                                scale: scale.toFixed(1) //round 
                            }

                            let cell_value = parent.get_cell_value(parent, selected_crate, loc).toFixed(2); //round to 2dec places ;
                            let color = parent.color_scheme(cell_value);

                            //draw the cells (rects) on screen 
                            crate_div
                                .append("rect")
                                //.style('pointer-events', 'none')
                                .attr('class', class_name)
                                //.attr('id', element.id+'_'+loc.x+'_'+loc.y)
                                .attr("x", function (d) {
                                    return loc.x;
                                })
                                .attr("y", function (d) {
                                    return loc.y;
                                })
                                .attr("width", parent.rect_size - offset)
                                .attr("height", parent.rect_size - offset)
                                .style('opacity', 0)
                                .attr('stroke', 'none')

                                //metadata attributes
                                .attr('data-crate', selected_crate)
                                .attr('data-loc', [loc.x, loc.y, loc.scale])
                                .attr('data-type', selected_feature)
                                .attr('data-value', cell_value)

                                //mouse interactions
                                .on("mouseover", function (d) {
                                    //on mouseover show th cell's value on the colorbar
                                    parent.set_cbar_value(parent, cell_value)
                                })
                                .on("mouseout", function (d) {
                                    d3.select('#hover_val').remove();
                                })

                                .transition() // <------- TRANSITION STARTS HERE --------
                                .delay(function (d, i) {
                                    let delay = parent.animation_delay(cell_value);
                                    return delay;
                                })
                                .duration(parent.animation_dur)
                                .style("fill", function (d) {
                                    return color
                                })
                                .style('opacity', parent.default_opacity);
                        }
                    }
                }
            }
        });

        //iterate through results to extract data required to show sensors on the floorplan
        let results = parent.sensor_data;
        //redraw the sensors on the newly generated heatmap;
        //mandatory passing the consolidated svg object due to svg offsetting
        parent.attach_sensors(parent, results, consolidated_svg)

        console.log('results', results)

        //debug only, "parent" now working somehow
        parent.set_colorbar(parent);

        console.log('done', Date.now())
        parent.startup = false;
        //adding another mask layer on top
        parent.make_sublayers();
        parent.animation_ticker(parent);
    }


    hide_heatmap(parent) {
        d3.selectAll('#heatmap').remove();
        d3.selectAll('#heatmap_sensors').remove();
        d3.select('#heatmap_splashes').remove();

        d3.selectAll('.non_heatmap_circle').style('opacity', 0.65);

        //make sure to pass the master object rather than the "heatmap parent" itself
        parent.master.get_choropleth(parent.master);
        parent.master.set_legend(parent.master)
    }

    //----------------------------------------------------------------//
    //-------------------END HEATMAP CALCULATIONS---------------------//
    //----------------------------------------------------------------//

    //display sensor on top of the heatmap
    attach_sensors(parent, results, svg_offset) {
        let scale = svg_offset.scale;
        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap_sensors');

        //declare circle properties - opacity and radius
        let rad = 4; // radius of sensor icon in METERS (i.e. XYZF before transform)
        for (let sensor in results) {
            try {
                //    console.log(sensor)
                //    console.log(results[sensor])
                //    console.log(results[sensor]['location'])
                let x_value = results[sensor]['location']['x'] * scale + svg_offset.x_off;
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['location']['y'] * scale + svg_offset.y_off;
                let floor_id = results[sensor]['location']['f'] * scale
                let sensor_id = results[sensor]['acp_id'];

                main_svg.append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("transform", null)
                    .attr("r", rad)
                    .attr("class", 'sensor_node')
                    .attr("id", sensor_id + "_hm") //'hm_' +
                    .attr('data-acp_id', sensor_id)
                    .style("opacity", parent.master.sensor_opacity)
                    .style("fill", "pink")
                    .style('stroke', 'black')
                    .on('mouseover', function (d) {
                        console.log(sensor_id, results[sensor]);
                    })
                //  .attr("transform", parent.master.svg_transform);

            } catch (error) {
                console.log(error)
            }

        }
    }
    //-----------------------------------------------------------------//
    //------------------------FAKE DEPLOYMENT--------------------------//
    //-----------------------------------------------------------------//


    //callback to update sensors (for faked sensor data)
    update_callback(parent, acp_id, walk) {
        parent.do_animation(parent, acp_id)
        // parent.draw_splash_alt(parent, acp_id, walk);
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    fake_splashes(parent) {
        console.log(parent.sensor_data)
        for (let sensor in parent.sensor_data) {
            console.log('incoming update ', sensor)
            let wildcard = false //Math.random() < 0.5;
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(7000, 7000 * 10), parent, sensor, wildcard);
        }
    }

    //show fake path on LL
    fake_path(parent) {
        let sens_list;
        switch (CRATE_ID) {
            case 'GF':
                sens_list = [
                    "elsys-ers-04f006",
                    "elsys-ers-04f007",
                    "elsys-snd-04bb60",
                    "elsys-ers-04f005",
                    "elsys-co2-0558bb",
                    "elsys-co2-0558b2",
                    "elsys-co2-0558b5",
                    "elsys-co2-0559f5",
                    "elsys-co2-0559f4",
                    "elsys-co2-0559f7",
                ]
                break;
            case 'FF':
                sens_list = ["elsys-ems-050368",
                    "elsys-co2-055872",
                    "elsys-eye-04d243",
                    "elsys-eye-04d241",
                    "elsys-eye-04d23c",
                    "elsys-eye-04d245",
                    "elsys-co2-0559fa",
                    "elsys-eye-04d23e",
                    "elsys-co2-05586f"
                ];
                break;
            case 'll_0':
                sens_list = [
                    "elsys-co2-0520ba",
                    "elsys-ems-0503e0",
                    "elsys-eye-044504",
                    "elsys-co2-0520bb",
                    "elsys-co2-0520bc",
                    "elsys-co2-0520bd",
                    "elsys-co2-0520be",
                    "elsys-co2-0520bf",
                    "elsys-co2-0520c0",
                    "elsys-co2-0520c1",
                    "elsys-co2-0520c2",
                    "elsys-co2-0520c3"
                ];
                break;
        }



        let counter = 1;
        for (let i = 0; i < sens_list.length; i++) {
            let sensor = sens_list[i];
            console.log('incoming update ', sensor)
            window.setTimeout(parent.update_callback, counter * 1000, parent, sensor, false);
            counter++;
        }
    }

    // Alternative to get_readings() using local file for sensors API response
    get_local_sensors(parent) {

        console.log('loading local data')

        //we have fake data only for wgb and vlab
        let selection = CRATE_ID == 'FF' ? 'WGB' : 'VLAB'; //for now leaving the Lockdown Lab away from this

        //local file loading from Django
        d3.json(window.location.origin + "/static_web/js/" + selection + "_JSON.json", {
            crossOrigin: "anonymous"

        }).then(function (received_data) {
            console.log('heatmap received', received_data)
            parent.handle_sensors_metadata(parent, received_data)

            //-----------------------------------//
            //---generate and show the heatmap---//
            //-----------------------------------//
            parent.show_heatmap(parent);
        });
    }

    //-----------------------------------------------------------------//
    //---------------------END FAKE DEPLOYMENT-------------------------//
    //-----------------------------------------------------------------//

    //-----------------------------------------------------------------//
    //----------------------------COLOR BAR----------------------------//
    //-----------------------------------------------------------------//

    //draws the horizontal line over the colobar bar when hovering over the heatmap
    set_cbar_value(parent, value) {

        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([parent.c_conf.height + parent.c_conf.bottom, parent.c_conf.bottom]); //TODO adjust for top offset as well
        let target_svg = d3.select("#legend_svg");

        target_svg.append('g')
            .attr('id', 'hover_val')
            .append('rect')
            .attr("y", function (d) {

                //adjust values
                if (value > parent.min_max_range.max) {
                    value = parent.min_max_range.max
                }
                if (value < parent.min_max_range.min) {
                    value = parent.min_max_range.min
                }

                return scale_inv(value)
            })
            .attr("x", parent.c_conf.width / 3)
            .attr("width", parent.c_conf.width / 4)
            .attr("height", 2.5)
            .style("fill", 'lime');

        //TODO: CHECK WHY FONT SIZE (4PX) DOESN'T WORK
        parent.jb_tools.add_text(d3.select("#hover_val"), parseFloat(value).toFixed(2), (parent.c_conf.width / 3) - 15, scale_inv(value), '0.75em', "translate(0,0)").attr("font-size", '0.75em')
        // 0 is the offset from the left

    }


    //creates a colobar element that displays the range of sensor readings on screen
    set_colorbar(parent) {
        d3.select("#legend_svg").remove();
        d3.selectAll('.non_heatmap_circle').style('opacity', 0);

        parent.master.legend_svg = d3.select('#legend_container')
            .append("svg")
            .attr("width", parent.c_conf.width + parent.c_conf.left + parent.c_conf.right)
            .attr("height", parent.c_conf.height + parent.c_conf.top + parent.c_conf.bottom)
            .attr('id', "legend_svg");

        //set the scale 
        let scale = d3.scaleLinear().domain([parent.c_conf.height, 0]).range([parent.min_max_range.min_abs, parent.min_max_range.max_abs]);
        //set the inverse scale 
        let scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([parent.c_conf.height, 0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = parent.master.legend_svg.selectAll(".bars")
            .data(d3.range(0, parent.c_conf.height), function (d, i) {
                return d;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .attr("y", function (i) {
                return parent.c_conf.bottom + i;
            })
            .attr("x", parent.c_conf.width / 3)

            .attr("height", 1)
            .attr("width", parent.c_conf.width / 4)

            .style("fill", function (d, i) {
                return parent.color_scheme(scale(d));
            });


        //text showing range on left/right
        //jb_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, dy, TRANSLATE);
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.max, (parent.c_conf.width / 2) - 3, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)").attr("font-size", '0.75em') // 0 is the offset from the left
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.min, (parent.c_conf.width / 2) - 3, scale_inv(parent.min_max_range.min) + parent.c_conf.bottom, "0.75em", "translate(0,0)").attr("font-size", '0.75em') // 0 is the offset from the left

        //TODO: CHECK WHY FONT SIZE (4PX) DOESN'T WORK
        //Adds the feature on the right side
        parent.jb_tools.add_text(parent.master.legend_svg, document.getElementById('features_list').value, (parent.c_conf.width / 2) - 160, scale_inv(parent.min_max_range.min) - 235, "3.5px", "rotate(-90)") // 0 is the offset from the left

    }

    //-----------------------------------------------------------------//
    //------------------------END COLOR BAR----------------------------//
    //-----------------------------------------------------------------//

    //-----------------------------------------------------------------//
    //--------------------UTILITY FUNCTIONS----------------------------//
    //-----------------------------------------------------------------//

    //calculates value ranges for temp/co2/humidity and other during runtime;
    //recalculations are made whenever a new heatmap is selected
    get_min_max(parent, feature) {

        let value_array = [];

        //iterate through the data based on requested feature and extract min/max values
        for (let reading in parent.sensor_data) {

            //console.log('minmax', reading, parent.sensor_data[reading].payload)
            let val = parent.sensor_data[reading].payload[feature];

            if (val != undefined) {
                value_array.push(val);
            }
        }

        console.log('value arr', value_array)

        //reset the main variable
        parent.min_max_range = {
            max: q95(value_array).toFixed(2), //max or the 90th percentile value to reduce outliers
            min: q05(value_array).toFixed(2), //min or the 10th percentile value to reduce outliers
            max_abs: Math.max(...value_array).toFixed(2), //absolute max
            min_abs: Math.min(...value_array).toFixed(2) //absolute min
        };

        //reset min_max values for scaling
        parent.color_scheme.domain([parent.min_max_range.min_abs, parent.min_max_range.max_abs]);
        parent.animation_delay.domain([parent.min_max_range.min_abs, parent.min_max_range.max_abs]);

        console.log('new minmax:', parent.min_max_range, 'feature:', feature);
    }
    //-----------------------------------------------------------------//
    //-------------------END UTILITY FUNCTIONS-------------------------//
    //-----------------------------------------------------------------//
}