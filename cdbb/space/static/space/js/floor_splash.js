"use strict"

class FloorSplash {

    constructor(floor_plan) {

        let parent = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        parent.master = floor_plan;

        // Instatiante an RTmonitor class
        parent.rt_con = new RTconnect(parent);

        //a set of useful d3 functions
        parent.jb_tools = new VizTools2();

        //set div id's show status change upon connect
        parent.txt_div_id = 'splash_rt';
        parent.status_div_id = 'splash_rt_state'

        //declare the splash color
        parent.splash_color = 'red';

        //--------------------------------------//
        //-------TIME PERIODS AND COLORS--------//
        //--------------------------------------//

        //all time periods are in seconds, e.g. 5mins*60s=300s, 1*h *60mins *60s=3600s aka 1 hour.
        parent.time_preset = {
            'period_a': 0,
            'period_b': 5 * 60, //5 minutes
            'period_c': 1 * 60 * 60, //60minutes
            'period_d': 24 * 60 * 60 //24 hours (or 86400 seconds to be precise)
        }

        parent.color_preset = {
            'period_ab': 'green', //most recent message <5mins
            'period_bc': 'yellow', //message has arrive within 5-60mins
            'period_cd': 'black', //message has arrived withing 1h-24hours
            'period_dd': 'white' //unheard from for more than 24hours
        }

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//
        parent.setup_buttons(parent);

    }

    // init() called when page loaded
    init() {

        let parent = this;

        parent.timer_short; //the socket has been unactive for a while -- color yellow
        parent.timer_long; //assume the socket connection was lost -- color red

        parent.chrono_timer; //timer for chrono keeper that checks time since last msg received for all sensors

        //separate animation to see how long the 'raindrop' or 'splash' remains visible
        parent.ripple_duration = 3500;

        //create a layer of svg masks so that splash ripples don't leave crate boundaries
        parent.make_clips(parent);

        //do rtmonitor connect, telling which sensors to subscribe to
        parent.connect_rt(parent);

        //get the contextual scaling for ripples
        parent.circle_radius = parent.master.sensor_radius;
        parent.svg_scale = parent.master.svg_scale;

        //get the current time
        parent.ts_initialised = Math.floor(Date.now() / 1000); //we need seconds so divide by thousant

        //initialise the data structure that tracks time since last message
        parent.init_chrono_keep(parent)

        //make all sensors white by default
        d3.selectAll('.sensor_node').style('fill', parent.color_preset['period_dd']) //make all sensors white
    }

    //--------------------------------------//
    //--------SET UP EVENT LISTENERS--------//
    //--------------------------------------//
    setup_buttons(parent) {
        //connect to rt monitor
        document.getElementById('rain_rt_connect').addEventListener('click', () => {
            parent.disconnect_rt(parent)
        });

        //create a legend
        document.getElementById('toggle_legend').addEventListener('click', () => {
            parent.set_legend(parent);

            //change the inner html property of the button
            document.getElementById('toggle_legend').innerHTML = 'Hide Legend'
            //change the button so you toggle back
            document.getElementById('toggle_legend').addEventListener('click', () => {
                d3.select("#legend_svg").remove();
            });


        });
    }

    //-----------------------------------------------------------------//
    //--------------------RTmonitor connectivity-----------------------//
    //-----------------------------------------------------------------//

    //connects to the rt monitor via websockets
    connect_rt(parent) {
        //get a list of all sensors rendered on screen
        parent.sub_list = Object.keys(API_SENSORS_INFO["sensors"]);

        //create an rtmonitor connection, telling which sensors to subscribe to
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

    //-----------------------------------------------------------------//
    //------------------end RTmonitor connectivity---------------------//
    //-----------------------------------------------------------------//

    //updates the rtmonitor status icon on the page
    check_status(value, msg) {
        let parent = this;

        switch (value) {
            //RealTime monitor connection successful
            case '1':
                document.getElementById(parent.txt_div_id).innerHTML = 'RTm Connected';
                document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(108, 255, 150)';
                break;

                //Message successfully received
            case '2':
                try {
                    let acp_id = msg.acp_id;

                    //update chrono keeper
                    //probably should be another function that simultaneoulsy changes the color of sensor if needed
                    parent.update_chrono_keeper(parent, acp_id)
                    //parent.chrono_keep[acp_id].last_msg = parseInt(msg.acp_ts);

                    //check if the new message only contains a "motion" trigger event
                    let motion_trigger = true;
                    let cooked = msg.payload_cooked;

                    //if payload_cooked only has a single key and it is 'motion' or 'occupancy'
                    // (usually paired though) then we now
                    //it's an interrupt triggered motion event
                    if ((Object.keys(cooked).length < 3) && (("motion" in cooked) || ("occupancy" in cooked))) {
                        console.log('motion-only event detected', cooked)
                        motion_trigger = false;
                    }

                    parent.draw_splash(parent, acp_id, motion_trigger)

                    console.log(acp_id, msg.payload_cooked)

                } catch (err) {
                    console.log('something went wrong', err)
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

                //latest messages
            case '3':
                console.log('latest_messages', msg)

                for (let i = 0; i < msg.length; i++) {
                    let acp_ts = parseInt(msg[i].acp_ts);
                    let acp_id = msg[i].acp_id;
                    parent.chrono_keep[msg[i].acp_id] = {
                        'acp_id': acp_id,
                        'last_msg': acp_ts
                    }
                    let time_since_last = (parent.ts_initialised - acp_ts);
                    //console.log(msg[i].acp_id, time_since_last, parent.ts_initialised, acp_ts)
                }

                //fill most recent data
                parent.periodic_chrono_keeper(parent);

                //set a an interval timer to know how long the messages haven't been coming in for
                parent.chrono_timer = setInterval(function () {

                    console.log('updating sensor colors', new Date())
                    parent.periodic_chrono_keeper(parent)

                }, 1000 * parent.periodic_timer); //every 30 seconds

            default:
                break;
        }
    }

    //initialises the chrono_keeper data structure that tracks time for each sensor since its last message has been received
    init_chrono_keep(parent) {

        //create an empty object
        parent.chrono_keep = {};

        //declare how often we want to check for changes in the chrono_keep data structure
        parent.periodic_timer = 30; //in seconds

        //ignore if no predefined sensors list
        if (parent.sub_list != undefined || parent.sub_list.length == 0) {
            return
        }

        //iterate over the list of rt_con subscribtions
        //and fill a dict with acp_id and last_msg value(time elapsed since last msg)
        for (let i = 0; i < parent.sub_list; i++) {
            parent.chrono_keep[parent.sub_list[i]] = {
                'acp_id': parent.sub_list[i],
                'last_msg': null
            }
        }
    }

    //update the chrono keepr for a selected (acp_id) sensor
    update_chrono_keeper(parent, acp_id) {

        //get the current time
        let current_time = Math.floor(Date.now() / 1000);

        //update the dictionary entry related to the acp_id sensor with the most recent timestamp
        parent.chrono_keep[acp_id].last_msg = current_time;

        //update styling to look green, or set to period color to be less than 5mins
        d3.select('#' + acp_id + '_bim').transition().duration(1000).style('fill', parent.color_preset['period_ab']);


    }
    //chrono keeper should be an interval that routinely checks the list if msgs

    periodic_chrono_keeper(parent) {
        let current_time = Math.floor(Date.now() / 1000);

        for (let sensor_id in parent.chrono_keep) {
            let last_message = parent.chrono_keep[sensor_id].last_msg;

            //calculate the time since the last message has been received
            let time_elapsed = current_time - last_message;

            //time elapsed is more than (OR EQUAL TO) 0s and less than (OR EQUAL TO) 5minutes
            if (time_elapsed >= parent.time_preset['period_a'] && time_elapsed <= parent.time_preset['period_b']) {
                //color the sensor the preset for period_ab, aka green
                d3.select('#' + sensor_id + '_bim').transition().duration(1000).style('fill', parent.color_preset['period_ab']);
            }

            //time elapsed is more than 5mins and less than 1 hour
            else if (time_elapsed > parent.time_preset['period_b'] && time_elapsed <= parent.time_preset['period_c']) {
                //color the sensor the preset for period_bc, aka yellow
                d3.select('#' + sensor_id + '_bim').transition().duration(1000).style('fill', parent.color_preset['period_bc']);
            }

            //time elapsed is more than 1hour and less than 24hours
            else if (time_elapsed > parent.time_preset['period_c'] && time_elapsed <= parent.time_preset['period_d']) {
                //color the sensor the preset for period_cd, aka black
                d3.select('#' + sensor_id + '_bim').transition().duration(1000).style('fill', parent.color_preset['period_cd']);
            }

            //time elapsed is more than 24hours
            else if (time_elapsed > parent.time_preset['period_d']) {
                console.log(sensor_id, 'is possibly dead, last heard ', time_elapsed, ' seconds ago')
                //color the sensor the preset for period_dd, aka white
                d3.select('#' + sensor_id + '_bim').transition().duration(1000).style('fill', parent.time_preset['period_dd']);
            }
            //something went wrong
            else {
                console.log('something went wrong', sensor_id, time_elapsed)
            }
        }
    }
    //------------------------------------------------------------------//
    //----------SVG modifications and drawing animations----------------//
    //------------------------------------------------------------------//

    //creates a sublayer of masks so that splashes
    //do not cross crate boundaries
    make_clips(parent) {

        //get the app_overlay layer and append a new sublayer for clippaths and splash animations
        const splash_canvas = d3.select("#app_overlay")
            .append("g")
            .attr('id', 'heatmap_splash_layer')

        //append a defs layer for masks
        const defs = splash_canvas.append("defs")

        //add a mask for every crate;
        //here we iterate ovre all drawn BIM polygons and make
        //a copy for each one as a mask polygon
        d3.selectAll('.crate').select('polygon').nodes().forEach(crate => {

            //append clip paths to the defs layer
            let clip_def = defs.append("clipPath")
                .attr('pointer-events', 'none')
                .attr("id", "clip_" + crate.id);

            //copy current polygon infornation and save it be reused for clip path polygons
            let polygon_points = crate.attributes.points.value.split(' '); //this creates a list of coordinates
            // let polygon_transform = crate.attributes.transform.value;
            //the last element in the the list of polygon coordinates is an empty string, so we remove it
            polygon_points.pop();

            //with the previous BIM polygon information, make its copy as a polygon clippath
            let crate_polygon =
                clip_def.append("polygon")
                .attr("points", polygon_points)
                // .attr("transform", polygon_transform)
                .attr('pointer-events', 'none')
                .attr('stroke-width', 0.01)
                .attr("stroke", "black")

            //g references for the layer that we will append drawn circles to
            let clippy = splash_canvas
                .append('g')
                .attr("id", 'clipped_' + crate.id)
                .attr("clip-path", "url(#clip_" + crate.id + ")") //pass the mask reference from above
        })
    }

    //draws splashes when new data arrives and recolors the entire crate based on the data
    //acp_id determine where the splash will radiate from, motion_trigger determines the size of the splash
    draw_splash(parent, acp_id, motion_trigger) {

        let crate_id;

        //find the crate the acp_id sensor is in
        try {
            crate_id = API_SENSORS_INFO["sensors"][acp_id].crate_id;
        } catch (err) {
            console.log(`draw_splash(): no crate_id for ${acp_id}`)
            return;
        }

        //the motion trigger argument determines the size of the splash
        //the idea here is that we want to emphasize motion triggered splashes,
        //whereas we declare periodic updates to be less importnat and hence smaller splashes are drawn

        //if !motion_trigger, draw a smaller circle
        let final_radius = motion_trigger == true ? parent.circle_radius * 10 : parent.circle_radius * 5;

        //get the sensor's position
        let position = {
            'x': d3.select('#' + acp_id + "_bim").attr('cx'),
            'y': d3.select('#' + acp_id + "_bim").attr('cy'),
            'transf': d3.select('#' + acp_id + "_bim").attr("transform")
        }

        let splash_scale = parent.master.svg_transform.scale;
        //draw three expanding circles as a splash
        for (let splash_index = 1; splash_index < 4; ++splash_index) {

            //stroke should be a function of time, so over the course of the splash animation
            //we change it from a thicker stroke to a smaller one, showing how the splash slowly disintegrates

            //calculate the starting stroke for the splash's circle
            let stroke_start = 4.5 / (splash_scale * splash_index); //strokes take into account the svg scale

            //calculate the finishing stroke for the splash's circle
            let stroke_finish = 1.5 / (splash_scale * splash_index); //strokes take into account the svg scale

            //create a delay for circles that create ripples
            let ms_delay = splash_index * 400;

            //a colors for splashes
            let colorA = 'red';

            //inline function definition for circles
            let create_circle = function (delay_sample, color_sample) {
                try {
                    d3.select("#clipped_" + crate_id) //target the mask
                        .append("circle")
                        .attr("pointer-events", "none")
                        .attr("cx", position.x)
                        .attr("cy", position.y)
                        .attr("r", 0) //start as a circle with 0 radius
                        .style("stroke-width", stroke_start)
                        .style("fill", 'none')
                        .style('stroke', color_sample) //defines the colors of the circle for splash animation
                        // .attr('transform', position.transf)
                        .transition() //initiate the transition
                        .delay(delay_sample)
                        .duration(parent.ripple_duration)
                        .ease(d3.easeSin)
                        .attr("r", final_radius) //the final circle radius before dissapearing
                        .style("stroke-opacity", 0)
                        .style("stroke-width", stroke_finish)
                        .on("interrupt", function () {
                            d3.select(this).remove(); //in case of an interrupt, cancel all and delete the circle
                        })
                        .on("end", function () {
                            d3.select(this).remove(); //remove ripples
                        });
                } catch (err) {
                    console.log('draw_splash: create_circle error', err)
                }
            }

            //create circles by passing different delays and colors
            create_circle(ms_delay, colorA);
        }


    }

    //---------------------------------//
    //-------CREATE A LEGEND-----------//
    //---------------------------------//

    //--------------LEGEND definition---------------//
    set_legend(parent) {

        d3.select("#legend_svg").remove();

        //Defines legend container size, appends it
        parent.legend_svg = d3.select("#legend_container")
            .append("svg")
            .attr("id", "legend_svg")
            .style("width", 100)
            .style("height", 225);

        parent.legend = parent.legend_svg.selectAll('g.legendEntry')
            .data(Object.values(parent.color_preset)) //a list of color presets
            .enter()
            .append('g').attr('class', 'legendEntry');

        //Adds small rectangles to the legend
        parent.legend
            .append('rect')
            .attr("x", 20)
            .attr("y", function (d, i) {
                return i * 25 + 5;
            })
            .attr("width", 15)
            .attr("height", 15)
            .style("fill-opacity", parent.master.sensor_opacity)
            .style("fill", function (d, i) {
                //color rectangles based on the order provided in the color_preset variable
                return Object.values(parent.color_preset)[i]
            })
            .style("stroke", "black")
            .style("stroke-width", 0.5)


        //Adds text to legend to show the extent
        parent.legend
            .append('text')
            .attr("x", 40) //leaves space after the <rect>
            .attr("y", function (d, i) {
                return i * 25 + 5;
            })
            .attr("dy", "0.8em") //place text one line *below* the x,y point
            .text(function (d, i) {//determines the legend values
                //get a list of time presets corresponding to diffferent colors in color_preset
                let time_preset_list = Object.values(parent.time_preset);

                //determine if hours or minutes
                let time_notation = time_preset_list[i] / 60 >= 60 ? 'h' : 'm';
                let time_divider = time_preset_list[i] / 60 >= 60 ? 3600 : 60;

                //first case will usually be in minutes
                if (i == 0) {
                    return '< ' + time_preset_list[i + 1] / time_divider + time_notation;
                }
                //last one will probably be in hours
                else if (i == time_preset_list.length - 1) {
                    return '> ' + time_preset_list[i] / time_divider + time_notation;
                }
                //all the rest can vary between minutes and hours
                else {
                    //determine if hours or minutes for a range of data
                    let time_notation_sec = time_preset_list[i] / 60 >= 60 ? 'h' : 'm';
                    let time_divider_sec = time_preset_list[i] / 60 >= 60 ? 3600 : 60;

                    return time_preset_list[i] / time_divider + time_notation + ' - ' + time_preset_list[i + 1] / time_divider_sec + time_notation_sec;
                }

            })
            .style("font-family", "sans-serif")
            .style("font-size", "10px");
    } // end set_legend



    //-----------------------------------------------------------------//
    //------------------------FAKE DEPLOYMENT--------------------------//
    //-----------------------------------------------------------------//

    mock_data(self) {
        let acp_id = self.sub_list[Math.floor(Math.random() * self.sub_list.length)];
        console.log('moooooock', acp_id)
        let msg_data = {
            'acp_id': acp_id,
            'acp_ts': 999,
            'payload_cooked': {
                "temperature": 21.7,
                "humidity": 19,
                "light": 21,
                "motion": 0,
                "vdd": 3652,
                "occupancy": 0
            }
        }

        let motion_trigger = true;
        parent.draw_splash(parent, acp_id, motion_trigger)

    }



    //callback to update sensors (for faked sensor data)
    update_callback(parent) {
        parent.mock_data(parent);
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    update_sensors(parent, number) {

        for (let i = 0; i < number; i++) {
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(6500, 6500 * 10), parent);
        }
    }

    //-----------------------------------------------------------------//
    //---------------------END FAKE DEPLOYMENT-------------------------//
    //-----------------------------------------------------------------//
}
