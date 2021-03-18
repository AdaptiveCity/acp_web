"use strict";

class VizTools2 {

    //viz_tools is a separate class that hass useful js functions and constants for the main viz to run
    constructor() {

        this.WEEK = 86400 * 7;

        this.ICON_LOADING = '<img src="./static/images/loading_icon.gif "width="100px" height="100px" >';

        this.HALF_TAB = '&emsp;&emsp;';
        this.TAB = '&emsp;&emsp;&emsp;&emsp;';

        this.tooltip_div = d3.select('#tooltip');

    }


    inside(point, vs) {
        // ray-casting algorithm based on
        // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html/pnpoly.html

        // array of coordinates of each vertex of the polygon
        // var polygon = [ [ 1, 1 ], [ 1, 2 ], [ 2, 2 ], [ 2, 1 ] ];
        // inside([ 1.5, 1.5 ], polygon); // true

        var x = point.x,
            y = point.y;

        // console.log(vs)
        var inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            var xi = vs[i].x,
                yi = vs[i].y;
            var xj = vs[j].x,
                yj = vs[j].y;

            var intersect = ((yi > y) != (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        // console.log(inside, point.x, point.y, vs)
        return inside;
    };

    random_int(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
    }

    dist(loc_one, loc_two) {
        let x1 = loc_one.x;
        let y1 = loc_one.y;

        let x2 = loc_two.x;
        let y2 = loc_two.y;

        return Math.hypot(x2 - x1, y2 - y1)
    }

    array_avg(arr) {
        return (arr.reduce((a, b) => a + b, 0) / arr.length)
    }


    arrays_equal(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length != b.length) return false;

        // If you don't care about the order of the elements inside
        // the array, you should sort both arrays here.
        // Please note that calling sort on an array will modify that array.
        // you might want to clone your array first.

        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    to_timestamp(str_date) {
        let datum = Date.parse(str_date);
        return datum / 1000;
    }


    //a general mapping function that takes a value and interpolates it
    //in a different range
    map_values(value, start1, stop1, start2, stop2) {
        return (value - start1) / (stop1 - start1) * (stop2 - start2) + start2;
    }

    //D3 tools to make life easier

    //configure canvas size and margins, returns and object
    //(width, height,top, right, bottom, left)
    canvas_conf(w, h, t, r, b, l) {
        return {
            width: w - l - r,
            height: h - t - b,
            top: t,
            right: r,
            bottom: b,
            left: l
        }
    }

    //create a canvas with predefined settings
    make_canvas(conf, target_div, transformation) {
        //conf is a an object returned by the func above
        //target_div is a string with a selected class/id e.g. '#chart_tooltip'
        //transformation defines location, it is a string e.g. 'translate(0,0)'
        return d3.select(target_div)
            .append("svg")
            .attr("width", conf.width + conf.left + conf.right)
            .attr("height", conf.height + conf.top + conf.bottom)
            .append("g")
            .attr("transform", transformation);
    }

    //add text to any location on the svg
    add_text(svg_target, txt, x_pos, y_pos, font_size, transformation, node_id) {
        //transformation defines location, it is a string e.g. 'translate(0,0)'
        return svg_target
            .append("g")
            .attr('id', node_id)
            .append("text")
            .attr("x", x_pos)
            .attr("y", y_pos)
            .attr("dy", font_size)
            .attr("text-anchor", "middle")
            .attr("transform", transformation)
            .text(txt);
    }

    //----------------------------------------------//
    //---------------TOOLTIP definition-------------//
    //----------------------------------------------//

    tooltips() {
        self = this;
        var previous_circle_radius;

        d3.selectAll("circle") // For new circle, go through the update process
            .on("mouseover", function (event, d) {
                previous_circle_radius = 0.5; //document.getElementById(el).getAttribute('r')

                // d3.select(this).transition().duration(250)
                //     .attr("r", 0.75);

                // Specify where to put label of text
                let x = event.pageX - document.getElementById('drawing_svg').getBoundingClientRect().x + 50;
                let y = event.pageY - document.getElementById('drawing_svg').getBoundingClientRect().y + 50;

                let eventX = event.pageX;
                let eventY = event.pageY;

                let tooltip_height = d3.select('#tooltip')._groups[0][0].clientHeight;
                let tooltip_width = d3.select('#tooltip')._groups[0][0].clientWidth;

                let tooltip_offset_y = 6;
                let tooltip_offset_x = 6;

                console.log('hover over', this, x, y);

                //var sensor_id = this.id;
                //extracted from the data-acp_id property embedded withing the html node
                let sensor_id = this.dataset.acp_id;

                //define sensor name on the tooltips
                //self.tooltip_div.attr("id", sensor_id + "-text");

                //make tooltip appear smoothly
                self.tooltip_div.style('visibility', 'visible')
                    .transition()
                    .duration(200)
                    .style("opacity", .9);

                // Create API url for sensor reading AND metadata
                //let readings_url = API_READINGS + 'get/' + sensor_id +'/?metadata=true';  OLD API
                //before we used tfc app9
                let readings_url = API_READINGS + 'get_feature/' + sensor_id + '/temperature/?metadata=true'
                console.log('circle mouseover fetching', readings_url)

                d3.json(readings_url, {
                    crossOrigin: "anonymous"
                }).then(function (received_data) {

                    console.log('tooltips() raw', received_data)
                    let reading = received_data["reading"];
                    let sensor_metadata = received_data["sensor_info"];

                    let reading_obj = '';
                    // let parsed=self.parse_readings.parse_reading(reading,sensor_metadata);     OLD API
                    //		console.log('parsed',parsed);

                    //check that the packet contains any readings
                    if (received_data['acp_error_msg'] != undefined) { //|| Object.keys(parsed).length<1 
                        let error_id = received_data['acp_error_id'];
                        console.log('handle_readings() error', received_data);
                        reading_obj = 'NO READINGS available for this sensor.';
                    } else {
                        reading_obj = reading;
                    }

                    //if returned msg object is string, then there was no message inside - show empty
                    let msg = typeof (reading_obj) == 'string' ? reading_obj : '';

                    //render the html tooltip element
                    self.tooltip_div.html('<b>' + sensor_id + '</b>' + "<br/>" + msg)
                        .style("left", function () {
                            //push the tooltip to the left rather than to the right if out of screen
                            if (eventX + tooltip_width > document.body.clientWidth) {
                                return eventX - tooltip_width + tooltip_offset_x + "px";
                            } else return eventX - tooltip_offset_x + "px";
                        })
                        .style("top", function () {
                            //drop the tooltip upwards rather than downwards if out of screen
                            if (eventY + tooltip_height > document.body.clientHeight) {
                                return eventY - tooltip_height + tooltip_offset_y + "px";
                            } else return eventY - tooltip_offset_y + "px";
                        });

                    //if return msg is an object (or not a string), then we have full readings - generate d3 canvas and draw elements
                    if (typeof (reading_obj) != 'string') {

                        //attach a timestamp
                        //convert to string and slice off the unnecessary bits (GMT etc)
                        let reading_ts = self.make_date(reading_obj['acp_ts']).toString().slice(0, 25);

                        //append under the sensor acp_id
                        let tooltip_el = document.getElementById('tooltip');
                        tooltip_el.insertAdjacentHTML('beforeend', reading_ts + "<br/>");

                        //generate colorbars
                        self.viz_readings(reading_obj, sensor_metadata)
                        reading_obj = undefined;
                        sensor_metadata = undefined;
                    }
                });
            })
            .on("mouseout", function (d) {

                self.tooltip_div.transition()
                    .duration(500)
                    //make invisible
                    .style("opacity", 0)
                    //make uninteractible with the mouse
                    .on('end', function (d) {
                        //remove old tooltip
                        d3.select(this).style('visibility', 'hidden')
                    })

            })
            // On a user 'click' of a sensor icon, jump to the 'sensor' page.
            .on('click', function (d) {
                let sensor_id = d3.select(this).node().dataset['acp_id']
                let sensor_url = SENSOR_LINK.replace('acp_id', sensor_id);
                console.log('click', sensor_url)
                window.location = sensor_url;
            });

    }

    //draws colorbar and heatmaps (if available)
    viz_readings(readings, meta) {

        //exrtact all features with ranges --needed for mouseover viz
        let all_features = meta['acp_type_info']['features'];

        //append the rest of the features with their ranges to the object
        readings['all_features'] = all_features;
        //console.log('readings', readings)

        //get a list of all features from metadata
        let feature_list = Object.keys(meta['acp_type_info'].features)
        let feature_length = feature_list.length;
        //console.log('viz', readings, meta);

        //iterate over all features and draw colorbars for each
        for (let i = 0; i < feature_length; i++) {
            self.draw_cbar(readings, readings.all_features[feature_list[i]], '#tooltip');
        }

        //heatmap is within try/catch since not all sensors have 8x8s
        try {
            self.draw_heatmap(readings, '#tooltip');
        } catch (error) {
            console.log('no elsys eye: ', error)
        }

    }

    parsed_reading_to_html(reading_obj) {
        if (reading_obj == null) {
            return ["<br/>no data"];
        }
        let formatted = []
        for (let [key, value_obj] of Object.entries(reading_obj)) {
            let feature_name = value_obj["name"];
            let feature_value = value_obj["value"];

            formatted.push("<br>" + `${feature_name}: ${feature_value}`);
        }
        return formatted
    }

    //----------------------------------------------//
    //------------------TOOLTIP end-----------------//
    //----------------------------------------------//


    //---------------HIGH LEVEL FUNCTIONS FOR TOOLTIPS----------------//

    draw_cbar(d, feature, target_div) {

        //(width, height, top, right, bottom, left)
        let c_conf = this.canvas_conf(250, 38, 5, 30, 15, 5);
        let cbar_svg = this.make_canvas(c_conf, target_div, "translate(" + c_conf.left + "," + c_conf.top + ")");

        //map the sensor values to the colorbar location
        let raw_value = jsonPath(d, feature['jsonpath'])[0]
        //console.log('d',d,'feature',feature,'rawval',raw_value)
        let mapped_value = parseInt(this.map_values(raw_value, feature.range[0], feature.range[1], 0, c_conf.width));

        // append the svg object to the body of the page
        let x_bar_offset = 15;
        let x_range_offset = -8;

        var colorScale = d3.scaleSequential(d3.interpolateWarm)
            .domain([0, c_conf.width])

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = cbar_svg.selectAll(".bars")
            .data(d3.range(c_conf.width), function (d) {
                return d;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .style("pointer-events", "none")
            .attr("x", function (i) {
                return i + x_bar_offset;
            })
            .attr("y", 0)
            .attr("height", c_conf.height)
            .attr("width", 1)
            .style("fill", function (d, i) {
                //if the i'th element is the same as the mapped reading value, draw a black line instead
                if (i == mapped_value) {
                    return 'black'
                } else return colorScale(d);
            });

        //text showing range on left/right
        //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
        this.add_text(cbar_svg, feature.range[0], x_range_offset, 0, "0.75em", "translate(0,0) rotate(-90)") // 0 is the offset from the left
        this.add_text(cbar_svg, feature.range[1], x_range_offset, 3, "0.75em", "translate(" + (c_conf.width + x_bar_offset) + ",0) rotate(-90)") // 3 is the offset from the right

        let value_type = this.add_text(cbar_svg, feature.name, x_bar_offset + 3, 3, "0.75em", "translate(0,0)") // 6 is the offset from the right
        value_type
            .style("text-anchor", "start")
            .style('fill', 'white')
            .style('fill-opacity', '60%');


        //actual value under the black bar
        this.add_text(cbar_svg, raw_value, mapped_value + x_bar_offset, 22, "0.75em", "translate(" + 0 + ",0)") // 3 is the offset from the right

        //drop one line
        cbar_svg = d3.select(target_div)
            .append("g")
            .html("<br>");
    }

    //draw an 8x8 matrix for elsys-eye sensors
    draw_heatmap(d, target_div) {
        console.log('target', target_div,d)
        //list for reformatted data
        let grid_data = [];

        //data cleanup
        for (let i = 0; i < d.payload_cooked.grideye.length; i++) {
            grid_data.push({
                'value': d.payload_cooked.grideye[i],
                'id': i,
                'y_pos': Math.floor(i / 8),
                'x_pos': Math.floor(i % 8)
            });
        }

        let c_conf = this.canvas_conf(250, 250, 15, 15, 15, 15);
        let h8x8_svg = this.make_canvas(c_conf, target_div, "translate(" + c_conf.left + "," + c_conf.top + ")");

        // Labels of row and columns
        let rows = [0, 1, 2, 3, 4, 5, 6, 7];
        let columns = [0, 1, 2, 3, 4, 5, 6, 7];

        // Build X scales and axis:
        let x = d3.scaleBand()
            .range([0, c_conf.width])
            .domain(rows)
            .padding(0.01);

        // Build X scales and axis:
        let y = d3.scaleBand()
            .range([0, c_conf.height])
            .domain(columns)
            .padding(0.01);

        // Build color scale
        let color_range = d3.scaleSequential(d3.interpolateTurbo)
            .domain([-5, 35]) //min temp -5, max 35

        h8x8_svg.selectAll()
            .data(grid_data, function (d, i) {
                return d;
            })
            .enter()
            .append("rect")
            .attr("x", function (d) {
                return x(d.x_pos)
            })
            .attr("y", function (d) {
                return y(d.y_pos)
            })
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", function (d) {
                return color_range(d.value)
            });

        // console.log('showing 8x8', grid_data)
    }


     // Return a javascript Date, given EITHER a UTC timestamp or a ISO 8601 datetime string
     make_date(ts) {
        let t;

        let ts_float = parseFloat(ts);
        if (!Number.isNaN(ts)) {
            t = new Date(ts_float * 1000);
        } else {
            // replace anything but numbers by spaces
            let dt = ts.replace(/\D/g, " ");

            // trim any hanging white space
            dt = dt.replace(/\s+$/, "");

            // split on space
            let dtcomps = dt.split(" ");

            // modify month between 1 based ISO 8601 and zero based Date
            dtcomps[1]--;

            t = new Date(Date.UTC(dtcomps[0], dtcomps[1], dtcomps[2], dtcomps[3], dtcomps[4], dtcomps[5]));
        }
        return t;
    }
    get_building_coordinates() {
        let drawing_svg = d3.select("#drawing_svg");
        drawing_svg.on("click", function () {
            console.log("node", d3.mouse(this));
        })
    }
    make_time(ts) {
        // Create a new JavaScript Date object based on the timestamp
        // multiplied by 1000 so that the argument is in milliseconds, not seconds.
        let date = new Date(ts * 1000);
        // Hours part from the timestamp
        let hours =  "0" +date.getHours();
        // Minutes part from the timestamp
        let minutes = "0" + date.getMinutes();
        // Seconds part from the timestamp
        let seconds = "0" + date.getSeconds();

        // Will display time in 10:30:23 format
        let formattedTime = hours.substr(-2) + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

        return formattedTime
    }

}