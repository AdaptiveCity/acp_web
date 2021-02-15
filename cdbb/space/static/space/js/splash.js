"use strict"

class SplashMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        //throughout the class the master is the main visualisation, parent is HeatMap
        this.master = floorspace;

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();

        //a set of useful d3 functions
        this.jb_tools = new VizTools2();

        this.CIRCLE_RADIUS = 0.5;
    }

    // init() called when page loaded
    init() {}

    draw_ripples(self, acp_id) { //<-D
        self.draw_splash(self, acp_id);

        for (var i = 1; i < 3; ++i) {

            let position = {
                'x': d3.select('#' + acp_id).attr('cx'),
                'y': d3.select('#' + acp_id).attr('cy'),
                'transf': d3.select('#' + acp_id).attr("transform")
            }

            let circle = d3.select('#bim_request').append("circle")
                .attr("cx", position.x)
                .attr("cy", position.y)
                .attr('transform', position.transf)
                .attr("r", 0)
                .style("stroke-width", 1 / (2 * i))
                .style("fill", 'none')
                .style('stroke', '#cc0000')
                .transition()
                .delay(Math.pow(i, 2.5) * 100)
                .duration(2000)
                .ease(d3.easeSin)
                .attr("r", 5) //radius for waves
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

        //self.add_hist(self, acp_id, msg_data)
        //self.set_colorbar(self)
        // self.reset_animations(self)
        self.do_pre_transition(self, acp_id);
    }


    draw_splash(self, acp_id) {
        //let multiplier = 1.1; //10% increaseCIRCLE_RADIUS
        let sensor_circle = d3.select('#' + acp_id);
        let new_color = 'purple' //self.color_scheme(self.msg_history[acp_id].pinged);
        sensor_circle
            .transition().duration(700)
            .attr('r', CIRCLE_RADIUS / 3)
            //.ease(d3.easeBackInOut.overshoot(3.5))
            //flash red to indicate a splash
            .style('fill', 'red')
            //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
            .on("interrupt", function () {
                sensor_circle.attr('r', CIRCLE_RADIUS);
                sensor_circle.attr('fill', new_color);
            })
            .on('end', function (d) {
                sensor_circle
                    //fill the circle with the new color
                    .style('fill', new_color)
                    .transition().duration(450)
                    //overshoot the easing to add a little wiggle effect, brings some life to circles
                    // .ease(d3.easeBackInOut.overshoot(3.5))
                    .attr('r', CIRCLE_RADIUS)
                    //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
                    .on("interrupt", function () {
                        sensor_circle.attr('r', CIRCLE_RADIUS);
                        sensor_circle.attr('fill', new_color);
                    });
            });
    }

    mock_data(self) {
        let acp_id = self.sub_list[Math.floor(Math.random() * self.sub_list.length)];
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
        self.msg_received(msg_data)
        //self.update_viz(self, acp_id, msg_data)
        self.update_floorplan(self, acp_id, msg_data);

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