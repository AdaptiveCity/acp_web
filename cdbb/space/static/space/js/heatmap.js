"use strict"

const DEFAULT_REZ = 6;
const HIGH_REZ = 4;
const LOW_REZ = 10;

class HeatMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        let self = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        self.master = floorspace;

        //declare the url to request data from
        self.query_url = "https://tfc-app9.cl.cam.ac.uk/api/readings/get_floor_feature/";

        // Instatiante an RTmonitor class
        self.rt_con = new RTconnect(self);

        //a set of useful d3 functions
        self.jb_tools = new VizTools2();

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//

        //Set up event listener for the HEATMAP BUTTON
        document.getElementById('show_rain').addEventListener('click', () => {

            //init the heatmap
            self.init(self);

            //first reset the drawn floorplan to it's original location
            self.master.manage_zoom.reset(self);
        })
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

        //the delay for drawing individual items during the animation
        parent.animation_delay = d3.scaleLinear().range([3000, 1000]);

        //heatmap opacity
        parent.default_opacity = 0.75;
        parent.sensor_opacity = 0.1;

        //set div id's show status change upon connect
        parent.txt_div_id = 'rain_rt';
        parent.status_div_id = 'rain_rt_state'

        //Use get_floor_sensors for the API calls, get_local_sensors for faked offline data

        parent.get_floor_sensors(parent);
        //parent.get_local_sensors(parent);

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS-2------//
        //--------------------------------------//

        document.getElementById('rain_rt_connect').addEventListener('click', () => {
            //get a list of all sensors rendered on screen
            parent.sub_list = Object.keys(parent.master.sensor_data);
            console.log('sensors', parent.sub_list)
            //do rtmonitor connect, telling which sensors to subscribe to
            parent.rt_con.connect(parent.check_status.bind(parent), parent.sub_list);
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
    }

    //Main raindrop function for incoming data:
    //selects a sensor and sets it to update on by creating a raindrop
    draw_splash(parent, acp_id, walk) {

        //get the data from the sensor data variable
        let sensor_data = parent.sensor_data[acp_id];

        //get drawn sensors' location on screen
        let sensor_loc = {
            x: document.getElementById("hm_" + acp_id).getAttribute("cx"),
            y: document.getElementById("hm_" + acp_id).getAttribute("cy")
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
                .transition() // <------- TRANSITION STARTS HERE --------
                .ease(d3.easeCubicIn)

                .delay(function (d, i) {

                    let delay = (((Math.cos(dist_delay / 20) + 1)) * 2);

                    if (delay < 50) {
                        delay = 0;
                    }
                    // console.log('delay', delay, Math.cos(dist_delay), 'dist', dist_delay, loc, sensor_loc)
                    // console.log('delay', delay,dist_delay);

                    return delay
                })
                .duration(200) //250
                .ease(d3.easeCubicIn)

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
                        .transition() // <------- TRANSITION STARTS HERE --------
                        .delay(function (d, i) {

                            let wave_len = 5;
                            let amplitude = 4000;

                            if (walk) {
                                wave_len = 2.5;
                                amplitude = 1000;
                            }
                            //dampening function
                            let warp_delay = (((Math.cos(dist_delay / wave_len) + 1)) * amplitude) / dist_delay;

                            // console.log('warp delay', warp_delay)
                            //since the funciton follow 
                            if (warp_delay > 200) {
                                warp_delay = 200;
                                if (walk) {
                                    warp_delay = 75;
                                }
                            }
                            if (warp_delay < 50) {
                                warp_delay = 0;

                            }
                            return warp_delay

                        })
                        .duration(function (d, i) {
                            if (walk) {
                                return 100
                            } else {
                                return 200
                            }
                        })
                        .ease(d3.easeLinear)
                        .style("fill", function (d) {
                            return color //'red'
                        })
                        .style('opacity', parent.default_opacity)

                        //setup interrupt cases when animationcan get suddenly cancelled by another
                        .on("interrupt", function () {
                            selected_node.attr('opacity', parent.default_opacity);
                            selected_node.attr('fill', color);
                        });
                })
        });

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
            parent.master.viz_tools.tooltips();

        });

    }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, results) {

        console.log("handle_sensors_metadata() loaded", results);

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in results['sensors']) {

            //TODO USE JSONPATH
            try {
                parent.sensor_data[sensor] = {
                    'acp_id': sensor,
                    'location': results['sensors'][sensor].acp_location_xyz,
                    'crate_id': results['sensors'][sensor].crate_id,
                    'payload': results['readings'][sensor].payload_cooked, // change with jsonPath -- charts.js example
                    'features': results['sensors'][sensor].acp_type_info.features,
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
                console.log('sensor not found:', error)
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
            sensor_loc = {
                x: x_value * scale,
                y: y_value * scale
            };

            //get the distance from the sensor_loc to the cell (rect) location
            let dist = parent.jb_tools.dist(sensor_loc, rect_loc)

            //push the sensor to the list of sensors used for the calculation of the cell (rect) color value
            sensor_data_points.push({
                'sensor': sensor.acp_id,
                'value': sensor.payload[feature],
                'dist': dist
            });

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

        d3.selectAll('polygon').attr('class', 'g0-9')


        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.master.page_floor_svg.clientHeight;
        let w = parent.master.page_floor_svg.clientWidth;

        let floor = document.querySelector("[data-crate_type='floor']");

        //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
        let scale = floor.transform.baseVal.consolidate().matrix.a

        let counter = 0;
        let crates_with_sensors_list = Object.keys(parent.crates_with_sensors);

        let rect_count = 0;

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

                counter++;

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
                            let loc = {
                                x: i - parent.rect_size / 2,
                                y: u - parent.rect_size / 2,
                                scale: scale
                            }

                            let cell_value = parent.get_cell_value(parent, selected_crate, loc);
                            let color = parent.color_scheme(cell_value);


                            //draw the cells (rects) on screen 
                            main_svg
                                .append("rect")
                                //.style('pointer-events', 'none')
                                .attr('class', class_name)

                                .attr("x", function (d) {
                                    return loc.x
                                })
                                .attr("y", function (d) {
                                    return loc.y
                                })
                                .attr("width", parent.rect_size - offset)
                                .attr("height", parent.rect_size - offset)
                                .style('opacity', 0)
                                .style('stroke-opacity', 0)
                                .attr('data-crate', selected_crate)
                                .attr('data-loc', [loc.x, loc.y, loc.scale])
                                .attr('data-type', selected_feature)
                                .attr('data-value', cell_value)

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
        this.attach_sensors(parent, results, scale)
        console.log('results', results)

        //debug only, "parent" now working somehow
        this.set_colorbar(parent);

        console.log('done', Date.now())

    }

    //first get all rects on a floor, then reiterate for rooms
    show_heatmap_alt(parent) {
        console.log('start alt', Date.now())

        let selected_feature = document.getElementById('features_list').value;
        parent.get_min_max(parent, selected_feature);

        d3.selectAll('polygon').attr('class', 'g0-9')

        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.master.page_floor_svg.clientHeight;
        let w = parent.master.page_floor_svg.clientWidth;

        let floor = document.querySelector("[data-crate_type='floor']");

        console.log('floor', floor)
        //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
        var scale = floor.transform.baseVal.consolidate().matrix.a;
        let transf_x = floor.transform.baseVal.consolidate().matrix.e;
        let transf_y = floor.transform.baseVal.consolidate().matrix.f;

        let bbox = floor.getBBox();

        let polygon_points = floor.points;

        let pol_h = bbox.height * scale;
        let pol_w = bbox.width * scale;
        let pol_top = bbox.y * scale;
        let pol_left = bbox.x * scale;

        let offset = 0;

        //  let rect_count = 0;
        for (let i = pol_left; i < pol_w + pol_left; i += parent.rect_size) {
            for (let u = pol_top; u < pol_h + pol_top; u += parent.rect_size) {

                //  rect_count++;

                let coords = {
                    'x': i / scale,
                    'y': u / scale,
                    'height': h,
                    'width': w
                };

                //check if inside the floor polygon
                if (parent.jb_tools.inside(coords, polygon_points)) {

                    let selected_crate = floor.id;
                    let loc = {
                        x: i - parent.rect_size / 2,
                        y: u - parent.rect_size / 2,
                        scale: scale
                    }

                    let cell_value = 1; //parent.get_cell_value(parent, selected_crate, loc);
                    let color = 'black'; //parent.color_scheme(cell_value);

                    main_svg
                        .append("rect")
                        //.style('pointer-events', 'none')
                        .attr('class', 'unassigned_rect')

                        .attr("x", function (d) {
                            return loc.x
                        })
                        .attr("y", function (d) {
                            return loc.y
                        })
                        .attr("width", parent.rect_size - offset)
                        .attr("height", parent.rect_size - offset)
                        .style('stroke-opacity', 0)
                        .attr('data-crate', selected_crate)
                        .attr('data-loc', [loc.x, loc.y, loc.scale])
                        .attr('data-coords', [coords.x, coords.y])

                        .style("fill", 'black')
                        .style('opacity', 0.5);
                }
            }
        }

        let crates_with_sensors_list = Object.keys(parent.crates_with_sensors);

        //d3.selectAll('polygon').nodes().forEach(element => {

        let polygon_alpha = d3.selectAll('polygon').nodes();
        let polygons = []
        console.log('polygons_total', polygon_alpha.length);

        polygon_alpha.forEach(function (d, i) {
            //  console.log(index, 'space',object)
            let has_sensors = crates_with_sensors_list.includes(d.id);

            if (d.dataset.crate_type != 'building' && d.dataset.crate_type != 'floor' && has_sensors) {
                polygons.push(d)
            }

        });

        console.log('polygons_total', polygons.length, polygons);

        // d3.selectAll('.unassigned_rect').nodes().forEach(rect => {
        let rects = d3.selectAll('.unassigned_rect').nodes();

        console.log('items:', 'rects:', rects.length, 'polygons', polygons.length);

        //pick a rectangle on screen
        for (let u = 0; u < rects.length; u++) {
            let rect = rects[u];

            let loc_raw = rect.dataset.loc.split(',');

            let loc = {
                x: rect.x.baseVal.value + parent.rect_size / 2,
                y: rect.y.baseVal.value + parent.rect_size / 2,
                scale: parseFloat(loc_raw[2])
            }
            //break;
            //try to fit a polygon
            for (let i = 0; i < polygons.length; i++) {
                let element = polygons[i];

                // if (element.dataset.crate_type != 'building' && element.dataset.crate_type != 'floor' && has_sensors) {

                let class_name = element.id + '_rect';

                let polygon_points2 = element.points;

                let polygon_points_new = [];

                for (let j = 0; j < polygon_points2.length; j++) {
                    polygon_points_new[j] = {
                        'x': null,
                        'y': null
                    };
                    polygon_points_new[j].x = polygon_points2[j].x * scale
                    polygon_points_new[j].y = polygon_points2[j].y * scale
                }

                console.log('checking ', element.id)

                if (parent.jb_tools.inside(loc, polygon_points_new)) {

                    let selected_crate = element.id;

                    let cell_value = parent.get_cell_value(parent, selected_crate, loc);
                    let color = parent.color_scheme(cell_value);

                    d3.select(rect)
                        .attr('class', class_name)
                        .style('opacity', 0)
                        .style('stroke-opacity', 0)
                        .attr('data-crate', selected_crate)
                        .attr('data-value', cell_value)

                        .on("mouseover", function (d) {
                            parent.set_cbar_value(parent, cell_value)
                        })
                        .on("mouseout", function (d) {
                            d3.select('#hover_val').remove();
                        })
                        //.call(parent.transition_value, duration)
                        // .call(parent.transition_random, duration)
                        // .call(parent.transition_sideways, duration)

                        .transition() // <------- TRANSITION STARTS HERE --------
                        .delay(function (d, i) {

                            let delay = Math.random() * (2000 - 750) + 750;
                            //let delay = parent.animation_delay(cell_value);
                            return delay;
                        })
                        .duration(parent.animation_dur)
                        .style("fill", function (d) {
                            return color //'red'
                        })
                        .style('opacity', parent.default_opacity);
                } else {
                    console.log('no', 'next polygon');
                    //break;
                }
            }
        }
        console.log('done polygons')

        //iterate through results to extract data required to show sensors on the floorplan
        //change name from results to else
        let results = parent.sensor_data;
        this.attach_sensors(parent, results, scale)
        console.log(results)

        //debug only, "parent" now working somehow
        this.set_colorbar(parent);

        console.log('done', Date.now())

    }

    hide_heatmap(parent) {
        d3.selectAll('#heatmap').remove();
        d3.selectAll('#heatmap_sensors').remove();

        d3.selectAll('.non_heatmap_circle').style('opacity', 0.65);

        //make sure to pass the master object rather than the "heatmap parent" itself
        parent.master.get_choropleth(parent.master);
        parent.master.set_legend(parent.master)
    }

    //----------------------------------------------------------------//
    //-------------------END HEATMAP CALCULATIONS---------------------//
    //----------------------------------------------------------------//

    //display sensor on top of the heatmap
    attach_sensors(parent, results, scale) {
        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap_sensors');
        //declare circle properties - opacity and radius
        let opac = 1;
        let rad = 4; // radius of sensor icon in METERS (i.e. XYZF before transform)
        for (let sensor in results) {
            try {
                //    console.log(sensor)
                //    console.log(results[sensor])
                //    console.log(results[sensor]['location'])
                let x_value = results[sensor]['location']['x'] * scale
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['location']['y'] * scale
                let floor_id = results[sensor]['location']['f'] * scale
                let sensor_id = results[sensor]['acp_id'];

                main_svg.append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("transform", null)
                    .attr("r", rad)
                    .attr("class", 'sensor_node')
                    .attr("id",  sensor_id)//'hm_' +
                    .style("opacity", parent.sensor_opacity)
                    .style("fill", "pink")
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
        parent.draw_splash(parent, acp_id, walk);
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    fake_splashes(parent) {
        console.log(parent.sensor_data)
        for (let sensor in parent.sensor_data) {
            console.log('incoming update ', sensor)
            let wildcard = Math.random() < 0.5;
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(20000, 20000 * 10), parent, sensor, wildcard);
        }
    }

    //show fake path
    fake_path(parent) {
        let sens_list = [
            "elsys-fake-738bf2",
            "elsys-fake-d6a9de",
            "elsys-fake-372c9d",
            "elsys-fake-290265",
            "elsys-fake-9354d3",
            "elsys-fake-f3b577",
            "elsys-fake-ffdfb4",
            "elsys-fake-c3e668",
            "elsys-fake-6bf9d0",
            "elsys-fake-1fd377",
            "elsys-fake-c7cf58",
            "elsys-fake-56f2e8",
            "elsys-fake-8bae37",
            "elsys-fake-2c9683"
        ];

        let counter = 1;
        for (let i = 0; i < sens_list.length; i++) {
            let sensor = sens_list[i];
            console.log('incoming update ', sensor)
            window.setTimeout(parent.update_callback, counter * 1000, parent, sensor, true);
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
        //make a global c_conf reference from the parent class
        let c_conf = parent.jb_tools.canvas_conf(38, 200, 0, 0, 37, 0);//(110, 320, 10, 5, 10, 5);

        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height+c_conf.bottom/2, c_conf.bottom/2]);//TODO adjust for top offset as well
        let target_svg = d3.select("#legend_svg");

        target_svg.append('g')
            .attr('id', 'hover_val')
            .append('rect')
            .attr("y", function (d) {
                return scale_inv(value)
            })
            .attr("x", c_conf.width / 3)
            .attr("width", c_conf.width / 4)
            .attr("height", 2.5)
            .style("fill", 'lime');

        let rounded_val = Math.round(value * 100 + Number.EPSILON) / 100
        
        //TODO: CHECK WHY FONT SIZE (4PX) DOESN'T WORK
        parent.jb_tools.add_text(d3.select("#hover_val"), rounded_val, (c_conf.width / 3) + 15, scale_inv(value), "4px", "translate(0,0)") // 0 is the offset from the left

    }


    //creates a colobar element that displays the range of sensor readings on screen
    set_colorbar(parent) {
        d3.select("#legend_svg").remove();
        d3.selectAll('.non_heatmap_circle').style('opacity', 0);

        //configure canvas size and margins, returns and object
        //(width, height,top, right, bottom, left)
        let c_conf = parent.jb_tools.canvas_conf(38, 200, 0, 0, 37, 0);//canvas_conf(110, 320, 20, 5, 20, 5);

        parent.master.legend_svg = d3.select('#legend_container')
            .append("svg")
            .attr("width", c_conf.width + c_conf.left + c_conf.right)
            .attr("height", c_conf.height + c_conf.top + c_conf.bottom)
            .attr('id', "legend_svg");

        //set the scale 
        let scale = d3.scaleLinear().domain([c_conf.height, 0]).range([parent.min_max_range.min, parent.min_max_range.max]);
        //set the inverse scale 
        let scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height, 0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = parent.master.legend_svg.selectAll(".bars")
            .data(d3.range(0, c_conf.height), function (d) {
                return d;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .attr("y", function (i) {
                return 20 + i;
            })
            .attr("x", c_conf.width / 3)

            .attr("height", 1)
            .attr("width", c_conf.width / 4)

            .style("fill", function (d, i) {
                return parent.color_scheme(scale(d));
            });


        //text showing range on left/right
        //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.max, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.min, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.min) + 25, "0.75em", "translate(0,0)") // 0 is the offset from the left

        //TODO: CHECK WHY FONT SIZE (4PX) DOESN'T WORK
        parent.jb_tools.add_text(parent.master.legend_svg, document.getElementById('features_list').value, (c_conf.width / 2) - 180, scale_inv(parent.min_max_range.min) - 262, "4px", "rotate(-90)") // 0 is the offset from the left

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

        let min = 999;
        let max = -999;

        //iterate through the data based on requested feature and extract min/max values
        for (let reading in parent.sensor_data) {

            console.log('minmax', reading, parent.sensor_data[reading].payload)
            let val = parent.sensor_data[reading].payload[feature]

            if (val > max) {
                max = val;
            }
            if (val < min) {
                min = val;
            }
        }

        //reset the main variable
        parent.min_max_range = {
            max: max,
            min: min
        };

        //reset min_max values for scaling
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);
        parent.animation_delay.domain([parent.min_max_range.min, parent.min_max_range.max]);

        console.log('minmax', min, max)

    }
    //-----------------------------------------------------------------//
    //-------------------END UTILITY FUNCTIONS-------------------------//
    //-----------------------------------------------------------------//
}