"use strict"

class SensorStatusDisplay {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();

        //a set of useful d3 functions
        this.jb_tools = new VizTools2();

        //counts the numbre of times each asp_id has been triggered
        //e.g. [{'acp_id':zzzzzzz, 'tt':3},...]
        this.msg_history = {};

        this.query_url = 'https://tfc-app9.cl.cam.ac.uk/api/sensors/list/?type_metadata=true'

        this.sensor_list = [];
        this.sub_list = [];

        this.CIRCLE_RADIUS = 15;
        this.scaling = 60;
        this.columns = 8;
        this.spacing = 25;
        this.margin = 25;
        this.rt_mon = new RTconnect();


    }


    // init() called when page loaded
    init(parent) {

        parent.status_div_id = 'ssd_rt_state';
        parent.txt_div_id = 'ssd_rt';

        //declare the min max range of values for temp/co2/humidity - will change during runtime
        parent.min_max_range = {
            'max': 3,
            'min': 0
        }

        //declare the main colorscheme for the heatmap
        parent.color_scheme = d3.scaleSequential(d3.interpolateTurbo)

        //total time to draw transitions between activating the heatmap
        parent.animation_dur = 350;

        d3.json(parent.query_url, {
            crossOrigin: "anonymous"
        }).then(function (queried_sensor_list) {

            parent.sensor_list = queried_sensor_list['sensors'];
            console.log('QUERIED SENSORS', queried_sensor_list, 'len', Object.keys(queried_sensor_list['sensors']).length)
            //filter out the sensors with non-conventional acp_ids
            // let sub_list = Object.keys(parent.sensor_list).filter(full_acp_id => {
            //     let acp_id_split = full_acp_id.split("-");

            //     if (acp_id_split[2] != undefined && acp_id_split[2].length > 5) {
            //         return full_acp_id
            //     }
            // });

            //TODO parse this using jsonPath or else to look if an acp_type property exists
            parent.sub_list = Object.keys(parent.sensor_list).filter(sensor_object => {
                console.log(sensor_object, parent.sensor_list[sensor_object]['acp_type_id'])
                if (parent.sensor_list[sensor_object].hasOwnProperty('acp_type_id')) return sensor_object;
            });

            console.log('new len', parent.sub_list.length)

            parent.draw_sensors(parent, parent.sub_list);

            parent.rt_mon.connect(parent.check_status.bind(parent), parent.sub_list);

            parent.today = new Date();
            parent.start_date = document.getElementById('start_time').innerHTML += parent.today.toString().slice(0, 24);

        });
    }

    //updates the rtmonitor status icon on the page
    check_status(value, msg) {
        let parent = this;
        console.log('returned', value, parent)
        //make a switch statement instead
        if (value == '1') {
            document.getElementById(parent.txt_div_id).innerHTML = 'RTm Connected';
            document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(108, 255, 150)';
            console.log('connected');
        } else if (value == '2') {
            try {
                let msg_data = msg;
                let acp_id = msg.acp_id;
                parent.update_viz(parent, acp_id, msg_data)
            } catch (err) {
                console.log('something went wrong', err)
            }

        } else {}
    }


    draw_sensors(parent, sensor_list) {
        var dataset = [],
            counter = 0;

        for (let y = 0; y < 999; y++) {
            for (let x = 0; x < parent.columns; x++) {
                if (counter > sensor_list.length - 1) {
                    break;
                }
                let sensor_object = {
                    'acp_id': sensor_list[counter],
                    'x': x * parent.scaling + parent.margin,
                    'y': y * parent.scaling + parent.margin
                }
                dataset.push(sensor_object);
                counter++;
            }
        }

        let height = Math.ceil(sensor_list.length / parent.columns) * parent.scaling + parent.margin;
        let width = parent.scaling * parent.columns + parent.margin;
        console.log('h and w (used to be 800,400)', height, width)
        var sampleSVG = d3.select("#viz")
            .append("svg")
            .attr('id', 'main_canvas')
            .attr("width", width + parent.margin)
            .attr("height", height + parent.margin); //write a funciton to estimate the height based on the len of SENSOR LIST

        sampleSVG.selectAll(".sensors")
            .data(dataset)
            .enter().append('g').attr("class", "sensors")
            .attr('id', function (d, i) {
                return d.acp_id + '_parent'
            })
            .append("circle")
            .style("stroke", "gray")
            .style("fill", "white")
            .attr("class", "sensor_circles")
            .attr('id', function (d, i) {
                return d.acp_id
            })
            .on('mouseover', function (d, i) {
                //will do tomorrow
                // rt_mon.viz_tools.tooltips();

                console.log(d.acp_id)
            })
            .attr("r", parent.CIRCLE_RADIUS)
            .attr("cx", function (d, i) {
                return parent.spacing + d.x
            })
            .attr("cy", function (d, i) {
                return parent.spacing + d.y
            }).attr('z-index', -1)
            .style('opacity', 0.85);

        sampleSVG.selectAll(".sensors")
            .append('g')
            .append("text")
            .attr('id', function (d, i) {
                return d.acp_id + '_pinged'
            })
            .attr("class", "sensor_txt")
            .style('opacity', 1)
            .style('fill', 'black')
            // .attr('z-index', 999)
            .attr("x", function (d, i) {
                //TODO make parametrizable based one the #of digits
                return 24 + d.x
            })
            .attr("y", function (d, i) {
                //TODO make parametrizable based one the #of digits
                return 28 + d.y
            })
            .attr("text-anchor", "middle")
            .style("font-size", "0.7em");

        sampleSVG.selectAll(".sensors")
            .append('g')
            .attr('id', function (d, i) {
                return d.acp_id + '_g'
            })
            .append("text")
            .attr('id', function (d, i) {
                return d.acp_id + '_txt'
            })
            .attr("class", "sensor_txt")
            .style('opacity', 1)
            .style('fill', 'black')
            .attr('z-index', 999)
            .attr("x", function (d, i) {
                return d.x + 9
            })
            .attr("y", function (d, i) {
                return 45 + d.y
            })
            // .attr("dy", "0 1 2" )

            .style("text-anchor", "middle")

            .style("font-size", "0.65em")
            .html(function (d, i) {
                let acp_id_array = d.acp_id.split("-");
                let new_str = '';
                for (let u = 0; u < acp_id_array.length; u++) {

                    new_str += acp_id_array[u] + '\n<br>';
                }
                return acp_id_array[2] //lines(acp_id_array)//textRadius(acp_id_array)//new_str //acp_id_array[2] //acp_id_array.join("<br>");

            })

    }


    update_viz(self, acp_id, msg_data) {
        self.add_hist(self, acp_id, msg_data)
        self.set_colorbar(self)

        self.draw_ripples(self, acp_id);
        // self.reset_animations(self)
    }

    draw_ripples(self, acp_id) { //<-D
        self.draw_splash(self, acp_id);

        for (var i = 1; i < 3; ++i) {

            let position = {
                'x': d3.select('#' + acp_id).attr('cx'),
                'y': d3.select('#' + acp_id).attr('cy'),
                'transf': d3.select('#' + acp_id).attr("transform")
            }

            let circle = d3.select('#main_canvas').append("circle")
                .attr("cx", position.x)
                .attr("cy", position.y)
                //.attr('transform', position.transf)
                .attr("r", 0)
                .style("stroke-width", 5 / (i))
                .style("fill", 'none')
                .style('stroke', '#cc0000')
                .transition()
                .delay(Math.pow(i, 2.5) * 100)
                .duration(2000)
                .ease(d3.easeSin)
                .attr("r", 50) //radius for waves
                .style("stroke-opacity", 0)
                .on("interrupt", function () {
                    d3.select(this).remove();
                })
                .on("end", function () {
                    d3.select(this).remove(); //remove ripples
                });
        }
    }

    draw_splash(self, acp_id) {
        //let multiplier = 1.1; //10% increaseCIRCLE_RADIUS
        let sensor_circle = d3.select('#' + acp_id);
        let new_color = self.color_scheme(self.msg_history[acp_id].pinged);
        sensor_circle
            .transition().duration(700)
            .attr('r', self.CIRCLE_RADIUS / 3)
            .ease(d3.easeBackInOut.overshoot(3.5))
            //flash red to indicate a splash
            .style('fill', 'red')
            //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
            .on("interrupt", function () {
                sensor_circle.attr('r', self.CIRCLE_RADIUS);
                sensor_circle.attr('fill', new_color);
            })
            .on('end', function (d) {
                sensor_circle
                    //fill the circle with the new color
                    .style('fill', new_color)
                    .transition().duration(450)
                    //overshoot the easing to add a little wiggle effect, brings some life to circles
                    .ease(d3.easeBackInOut.overshoot(3.5))
                    .attr('r', self.CIRCLE_RADIUS)
                    //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
                    .on("interrupt", function () {
                        sensor_circle.attr('r', self.CIRCLE_RADIUS);
                        sensor_circle.attr('fill', new_color);
                    });
            });
    }

    add_hist(self, acp_id, msg) {
        //test2['ccc']={'a':'b', 'c':[]}
        //test2.hasOwnProperty("ccc") // true
        let has_happened = self.msg_history.hasOwnProperty(acp_id);
        if (has_happened) {
            self.msg_history[acp_id].pinged = self.msg_history[acp_id].pinged + 1;
            self.msg_history[acp_id].msg_hist[0] = msg; //to CHANGE-> save two most recent messages
        } else {
            //create a new entry
            self.msg_history[acp_id] = {
                'acp_id': acp_id,
                'pinged': 1,
                'msg_hist': [msg]
            }
        }

        //get the txt box div
        let txt_hist = document.getElementById('text_collector');

        //reformat the message (for time or date)
        let recieved_time = self.viz_tools.make_time(msg.acp_ts) //alternatively use self.viz_tools.make_date(msg.acp_ts)

        //senf json object to the debug panel
        //*Important* only works with JSON.stringify(clean_msg_json)
        let clean_msg_json = {
            'acp_ts': msg.ts,
            'acp_id': msg.acp_id,
            'cooked': msg.payload_cooked
        }; //<br>'+INDENT+.substring(1, yourString.length-1)
        let cooked_txt = JSON.stringify(msg.payload_cooked); //optionally add (msg.payload_cooked,undefined, 10)10 is the indent
        let cooked_txt_clean = cooked_txt == undefined ? 'no msg' : cooked_txt.substring(1, cooked_txt.length - 1)

        let clean_msg_txt = recieved_time + '&nbsp&gt;&nbsp' + '<span id="green_span">' + msg.acp_id + "</span>" + '<pre id="json_msg">' + cooked_txt_clean + '</pre>';

        // txt_hist.innerHTML = JSON.stringify(clean_msg) + '<br><br>' + txt_hist.innerHTML;
        txt_hist.innerHTML = clean_msg_txt + '<br><br>' + txt_hist.innerHTML;

        var recent = new Date();
        document.getElementById('most_recent').innerHTML = recent.toString().slice(0, 24);

        // txt_hist.innerHTML += JSON.stringify(clean_msg)+'\n';
    }

    set_colorbar(self) {
        let parent = self;
        parent.get_min_max(parent)

        //avoid havinf a colorbar with identical top and lower values
        if (self.min_max_range.max == self.min_max_range.min) {
            return
        }

        //recolor if changed min_max
        d3.selectAll('.sensor_circles').transition().duration(1000).style('fill', function (d, i) {
            let acp_id = d.acp_id;
            let pinged;
            let color;

            try {
                pinged = self.msg_history[acp_id].pinged;
                color = self.color_scheme(pinged);

                /* Create the text for each block */
                d3.select('#' + acp_id + '_pinged')
                    // .attr("dx", function (d) {
                    //     return -20
                    // })
                    .text(function (d) {
                        return pinged
                    })

            } catch (error) {
                color = 'white';
            }

            return color
        });

        d3.select("#legend_svg").remove();
        //d3.selectAll('.non_heatmap_circle').style('opacity', 0);
        let legend_svg_parent = d3.select('#legend_container');

        //configure canvas size and margins, returns and object
        //(width, height,top, right, bottom, left)
        let c_conf = parent.jb_tools.canvas_conf(110, 320, 20, 5, 20, 5);

        legend_svg_parent
            .append("svg")
            .attr("width", c_conf.width + c_conf.left + c_conf.right)
            .attr("height", c_conf.height + c_conf.top + c_conf.bottom)
            .attr('id', "legend_svg");
        let legend_svg = d3.select('#legend_svg');

        var scale = d3.scaleLinear().domain([c_conf.height, 0]).range([parent.min_max_range.min, parent.min_max_range.max]);
        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height, 0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = legend_svg.selectAll(".bars")
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
        parent.jb_tools.add_text(legend_svg, parent.min_max_range.max, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(legend_svg, parent.min_max_range.min, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.min) + 25, "0.75em", "translate(0,0)") // 0 is the offset from the left

        parent.jb_tools.add_text(legend_svg, 'pinged', (c_conf.width / 2) - 220, scale_inv(parent.min_max_range.min) - 265, "0.85em", "rotate(-90)") // 0 is the offset from the left

    }




    //calculates value ranges for temp/co2/humidity and other during runtime;
    //recalculations are made whenever a new heatmap is selected
    get_min_max(parent) {

        let min = 999;
        let max = -999;

        //iterate through the data based on requested feature and extract min/max values
        for (let entry in parent.msg_history) {

            //    console.log('minmax', entry, parent.msg_history[entry].pinged)
            let val = parent.msg_history[entry].pinged

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
            min: 1
        };

        //reset min_max values for scaling
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);
        //parent.animation_delay.domain([parent.min_max_range.min, parent.min_max_range.max]);

        console.log('minmax', min, max)

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

        self.update_viz(self, acp_id, msg_data)
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

function wrap(text, width) {
    text.each(function () {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            y = text.attr("y"),
            dy = parseFloat(text.attr("dy")),
            tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
}