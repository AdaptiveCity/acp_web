"use strict"

class SplashMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        let self = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        self.master = floorspace;

        // Instatiante an RTmonitor class
        self.rt_con = new RTconnect(self);

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        //self.viz_tools = new VizTools();

        //a set of useful d3 functions
        self.jb_tools = new VizTools2();

        //set div id's show status change upon connect
        self.txt_div_id = 'splash_rt';
        self.status_div_id = 'splash_rt_state'

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//

        //Set up event listener to connect to RTmonitor
        document.getElementById('show_splash').addEventListener('click', () => {
            self.init(self);
        })

    }



    // init() called when page loaded
    init(parent) {

        //get a list of all sensors rendered on screen
        parent.sub_list = Object.keys(parent.master.sensor_data);
        console.log('sensors', parent.sub_list)

        parent.timer_short; //the socket has been unactive for a while -- color yellow
        parent.timer_long; //assume the socket connection was lost -- color red
        
        //do rtmonitor connect, telling which sensors to subscribe to
        parent.rt_con.connect(parent.check_status.bind(parent), parent.sub_list);

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
                    let msg_data = msg;
                    parent.update_floorplan(parent, msg_data)
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


    draw_ripples(self, acp_id) { //<-D

        console.log('ripple', acp_id);
        self.draw_splash(self, acp_id);

        for (var i = 1; i < 3; ++i) {

            //calculate the stroke for the splash's circle
            let stroke = 4 / (self.svg_scale * i);

            let position = {
                'x': d3.select('#' + acp_id + "_bim").attr('cx'),
                'y': d3.select('#' + acp_id + "_bim").attr('cy'),
                'transf': d3.select('#' + acp_id + "_bim").attr("transform")
            }

            let circle = d3.select('#bim_request').append("circle")
                .attr("cx", position.x)
                .attr("cy", position.y)
                .attr('transform', position.transf)
                .attr("r", 0)
                .style("stroke-width", stroke)
                .style("fill", 'none')
                .style('stroke', '#cc0000')
                .transition()
                .delay(Math.pow(i, 2.5) * 100)
                .duration(2000)
                .ease(d3.easeSin)
                .attr("r", self.circle_radius * 10) //radius for waves
                .style("stroke-opacity", 0)
                .on("interrupt", function () {
                    d3.select(this).remove();
                })
                .on("end", function () {
                    d3.select(this).remove(); //remove ripples
                });
        }
    }

    update_floorplan(self, msg_data) {
        let acp_id = msg_data.acp_id;
        //console.lo
        //self.add_hist(self, acp_id, msg_data)
        //self.set_colorbar(self)
        // self.reset_animations(self)
        self.draw_ripples(self, acp_id);
    }


    draw_splash(self, acp_id) {
        //let multiplier = 1.1; //10% increase self.circle_radius
        let sensor_circle = d3.select('#' + acp_id + "_bim");
        let new_color = 'purple' //self.color_scheme(self.msg_history[acp_id].pinged);
        sensor_circle
            .transition().duration(700)
            .attr('r', self.circle_radius / 3)
            //.ease(d3.easeBackInOut.overshoot(3.5))
            //flash red to indicate a splash
            .style('fill', 'red')
            //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
            .on("interrupt", function () {
                sensor_circle.attr('r', self.circle_radius);
                sensor_circle.attr('fill', new_color);
            })
            .on('end', function (d) {
                sensor_circle
                    //fill the circle with the new color
                    .style('fill', new_color)
                    .transition().duration(450)
                    //overshoot the easing to add a little wiggle effect, brings some life to circles
                    // .ease(d3.easeBackInOut.overshoot(3.5))
                    .attr('r', self.circle_radius)
                    //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
                    .on("interrupt", function () {
                        sensor_circle.attr('r', self.circle_radius);
                        sensor_circle.attr('fill', new_color);
                    });
            });
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
        //self.msg_received(msg_data)
        //self.update_viz(self, acp_id, msg_data)
        self.update_floorplan(self, msg_data);

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