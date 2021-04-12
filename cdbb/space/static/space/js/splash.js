"use strict"

class SplashMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        let parent = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        parent.master = floorspace;

        // Instatiante an RTmonitor class
        parent.rt_con = new RTconnect(parent);

        //a set of useful d3 functions
        parent.jb_tools = new VizTools2();

        //set div id's show status change upon connect
        parent.txt_div_id = 'splash_rt';
        parent.status_div_id = 'splash_rt_state'

        //declare the splash color
        parent.splash_color='red';

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//

        //connect to rt monitor
        document.getElementById('rain_rt_connect').addEventListener('click', () => {
            parent.disconnect_rt(parent)
        });

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

    //connects to the rt monitor via websockets
    connect_rt(parent) {
        //get a list of all sensors rendered on screen
        parent.sub_list = Object.keys(parent.master.sensor_data);

        //create an rtmonitor connection, telling which sensors to subscribe to
        parent.rt_con.connect(parent.check_status.bind(parent), parent.sub_list);
    }

    // init() called when page loaded
    init(parent) {
        console.log('loading', JSON.stringify(parent.master), parent.master['sensor_data'], parent.master.sensor_data)

        parent.timer_short; //the socket has been unactive for a while -- color yellow
        parent.timer_long; //assume the socket connection was lost -- color red

        //separate animation to see how long the 'raindrop' or 'splash' remains visible
        parent.ripple_duration = 3500;

        parent.make_masks(parent);

        //do rtmonitor connect, telling which sensors to subscribe to
        parent.connect_rt(parent);

        //get the contextual scaling for ripples
        parent.circle_radius = parent.master.sensor_radius;
        parent.svg_scale = parent.master.svg_scale;
    }

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
                    console.log('new_msg', msg)
                    let acp_id = msg.acp_id;
                    let motion_trigger = true;
                    parent.draw_splash(parent, acp_id, motion_trigger)
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

            default:
                break;
        }
    }

    //creates a sublayer of masks so that splashes 
    //do not cross crate boundaries
    make_masks(parent) {

        //get the app_overlay layer and append a new sublayer for masks
        const splash_canvas = d3.select("#app_overlay")
            .append("g")
            .attr('id', 'heatmap_splash_layer')

        //append a defs layer for masks
        const defs = splash_canvas.append("defs")

        //add a mask for every crate;
        //here we iterate ovre all drawn BIM polygons and make 
        //a copy for each one as a mask polygon
        d3.selectAll('polygon').nodes().forEach(crate => {

            //append masks to the defs layer
            let mask = defs.append("mask")
                .attr('pointer-events', 'none')
                .attr("id", "mask_" + crate.id);

            //copy current polygon infornation and save it be reused for mask polygons
            let polygon_points = crate.attributes.points.value.split(' '); //this creates a list of coordinates
            let polygon_transform = crate.attributes.transform.value;
            //the last element in the the list of polygon coordinates is an empty string, so we remove it
            polygon_points.pop();

            //with the previous BIM polygon information, make its copy as a mask
            let crate_polygon =
                splash_canvas.append("polygon")
                .attr("points", polygon_points)
                .attr("transform", polygon_transform)
                .attr('pointer-events', 'none')
                .attr('stroke-width', 0.01)
                .attr("stroke", "black")
                .attr("mask", "url(#mask_" + crate.id + ")") //pass the mask reference from above
                .attr("fill", parent.splash_color) //determines what color the splash will look like
        })
    }

    //draws splashes when new data arrives and recolors the entire crate based on the data
    //acp_id determine where the splash will radiate from, motion_trigger determines the size of the splash
    draw_splash(parent, acp_id, motion_trigger) {

        //find the crate the acp_id sensor is in
        let crate_id = parent.master.sensor_data[acp_id].crate_id;

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

        //draw three expanding circles as a splash
        for (let splash_index = 1; splash_index < 4; ++splash_index) {

            //stroke should be a function of time, so over the course of the splash animation
            //we change it from a thicker stroke to a smaller one, showing how the splash slowly disintegrates

            //calculate the starting stroke for the splash's circle
            let stroke_start = 4.5 / (parent.svg_scale * splash_index); //strokes take into account the svg scale

            //calculate the finishing stroke for the splash's circle
            let stroke_finish = 1.5 / (parent.svg_scale * splash_index); //strokes take into account the svg scale

            //create an expanding circle that will disappear when it finishes the animation
            let circle =
                d3.select("#mask_" + crate_id) //target the mask
                .append("circle")
                .attr("pointer-events", "none")
                .attr("cx", position.x)
                .attr("cy", position.y)
                .attr("r", 0) //start as a circle with 0 radius
                .style("stroke-width", stroke_start)
                .style("fill", 'none')
                .style('stroke', 'white') //make sure it's different from the mask color
                .transition() //initiate the transition
                .delay(splash_index * 400)
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
        }


    }

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

}