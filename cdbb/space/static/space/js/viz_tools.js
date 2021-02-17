"use strict"

// uses:
//   API_READINGS
//   SENSOR_LINK
//   js/parse_readings.js

class VizTools {
    //----------------------------------------------//
    //--------------TABLE definition----------------//
    //----------------------------------------------//

    constructor() {
        // Define the div for the tooltip
        //this.tooltip_div = d3.select("body").append("div")
        //    .attr("class", "tooltip")
        //    .style("opacity", 0);

        this.viz_tools2 = new VizTools2();
    }

    init() {
        this.tooltip_div = d3.select('#tooltip');
        this.parse_readings = new ParseReadings();
    }

    /* Thanks to http://bl.ocks.org/phil-pedruco/7557092 for the table code */
    tabulate(data, columns) {

        //divide into five columns
        let corridors = [0, 30, 60, 90, 120, 150];
        let table_div = d3.select("#table_container");

        //Generates three columns, one per corridor (ish)
        for (let i = 0; i < corridors.length - 1; i++) {
            let dta = data.slice(corridors[i], corridors[i + 1]);
            let tbl = table_div.append("table").style("float", "left");
            this.addTableColumns(columns, tbl, dta);
        }

        //Adds individual "id"s to <tr> divs so they can be activated when hovering svg
        let tr_tags = document.getElementsByTagName("tr");
        for (let i = 0; i < tr_tags.length; i++) {
            let element = document.getElementsByTagName("tr")[i];
            let element_value = element.firstElementChild.textContent;
            element.id = element_value + "_tr";
        }

        d3.selectAll("tr")
            .on("mouseover", function (d) {
                d3.select(this).style("background-color", "#fec44f");
                let room_selection = document.getElementById(d.crate_id);

                if (d3.select(room_selection).classed("active"))
                    return; /* no need to change class when room is already selected */
                d3.select(room_selection).attr("class", "hover");

            })
            .on("mouseout", function (d) {
                d3.select(this).style("background-color", "whitesmoke")
                let room_id = d.crate_id;

                let room_selection = document.getElementById(room_id);

                if (d3.select(room_selection).classed("active")) return;
                d3.select(room_selection).attr("class", function (d) {
                    /* reset room color to quantize range */
                    return quantize_class(quantize(rateById.get(this.id)));
                });
            });

        return table_div;
    }

    //Function to append columns side by side so we
    //do not end up with a a single 135 row-long list
    //that stretches beyond screen limits
    addTableColumns(columns, table, data_) {
        var thead = table.append("thead"),
            tbody = table.append("tbody");

        table.style("width", "7em").style("font-size", "1.3em")
        // append the header row
        thead.append("tr")
            .selectAll("th")
            .data(columns) //columns
            .enter()
            .append("th")
            .style("background-color", "green")
            .style("color", "white")
            .text(function (column) {
                return column;
            });
        // create a row for each object in the data
        let rows = tbody.selectAll("tr")
            .data(data_)
            .enter()
            .append("tr")
            .style("background-color", "whitesmoke")
            .on("click", function (d) {
                tableRowClicked(d)
            });

        // create a cell in each row for each column
        let cells = rows.selectAll("td")
            .data(function (row) {
                return columns.map(function (column) {
                    return {
                        column: column,
                        value: row[column]
                    };
                });
            })
            .enter()
            .append("td")
            .attr("style", "font-family: Courier") // sets the font style
            .html(function (d) {
                return d.value;
            });
        return table

    }

    tableRowClicked(x) {
        /* resets colors and zooms into new room */
        resetAll();
        lastActive = x.room;
        console.log(x.room)
        zoomed(d3.select(floorplan).selectAll("#" + x.room));
    }

    //---------------------------------------//
    //-----------TABLE end-------------------//
    //---------------------------------------//

    //----------------------------------------------//
    //---------------TOOLTIP definition-------------//
    //----------------------------------------------//

    tooltips() {
        self = this;
        var previous_circle_radius;

        d3.selectAll("circle") // For new circle, go through the update process
            .on("mouseover", function (event, d) {
                previous_circle_radius = 0.5;

                d3.select(this).transition().duration(250)
                    .attr("r", 0.75);

                // Specify where to put label of text
                let x = event.pageX - document.getElementById('drawing_svg').getBoundingClientRect().x + 50;
                let y = event.pageY - document.getElementById('drawing_svg').getBoundingClientRect().y + 50;

                let eventX = event.pageX;
                let eventY = event.pageY;

                let tooltip_height = d3.select('#tooltip')._groups[0][0].clientHeight;
                let tooltip_width = d3.select('#tooltip')._groups[0][0].clientWidth;

                let tooltip_offset_y = 6;
                let tooltip_offset_x = 6;

                console.log(x, y);

                var sensor_id = this.id;

                //define sensor name on the tooltips
                //self.tooltip_div.attr("id", sensor_id + "-text");

                //make tooltip appear smoothly
                self.tooltip_div.style('visibility', 'visible')
                    .transition()
                    .duration(200)
                    .style("opacity", .9);

                // Create API url for sensor reading AND metadata
                //let readings_url = API_READINGS + 'get/' + sensor_id +'/?metadata=true';  OLD API
                let readings_url = 'https://tfc-app9.cl.cam.ac.uk/api/readings/get_feature/' + sensor_id + '/temperature/?metadata=true'
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
                        let reading_ts=self.make_date(reading_obj['acp_ts']).toString().slice(0,25);

                        //append under the sensor acp_id
                        let tooltip_el = document.getElementById( 'tooltip' );
                        tooltip_el.insertAdjacentHTML( 'beforeend', reading_ts+ "<br/>" );

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

                d3.select(this).transition()
                    .duration(250)
                    .attr("r", previous_circle_radius);

            })
            // On a user 'click' of a sensor icon, jump to the 'sensor' page.
            .on('click', function (d) {
                let sensor_id = this.id;
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
            this.viz_tools2.draw_cbar(readings, readings.all_features[feature_list[i]], '#tooltip');
        }

        //heatmap is within try/catch since not all sensors have 8x8s
        try {
            this.viz_tools2.draw_heatmap(readings, '#tooltip');
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

    //--------------------------------------------------//
    //------------------ZOOM definition-----------------//
    //--------------------------------------------------//

    zoomed(d) {
        /* Thanks to http://complextosimple.blogspot.ie/2012/10/zoom-and-center-with-d3.html 	*/
        /* This function centers the room's bounding box in the map container		*/

        console.log("VizTools zoomed()");

        //resize all cirlces on screen upon zoom

        d3.selectAll("circle").transition()
            .duration(1000)
            .attr("r", 8)
            .style("opacity", 1);

        /* The scale is set to the minimum value that enables the room to fit in the	*/
        /* container, horizontally or vertically, up to a maximum value of 3.			*/
        var box = this.getBoundingBox(d); /* get top left co-ordinates and width and height 	*/
        console.log(box);

        /* zoom into new room */
        console.log("zoomed() resetting")

        /* scale is the max number of times bounding box will fit into container, capped at 3 times */
        var scale = Math.min(mw / box.w, mh / box.h, 3);

        /* tx and ty are the translations of the x and y co-ordinates */
        /* the translation centers the bounding box in the container  */
        var tx = -box.x + (mw - box.w * scale) / (2 * scale);
        var ty = -box.y + (mh - box.h * scale) / (2 * scale);

        main_chart_svg.selectAll("#bim_request").attr("transform", "scale(" + scale + ")translate(" +
            tx + "," + ty +
            ")");

        //set surrounding polygons as inactive (fills in them white)
        d3.selectAll('polygon').attr('class', 'inactive');
        //set zoomed() object to active (fills in orange)
        d.attr('class', 'active');

        /* If the full width of container is not required, the room is horizontally centred */
        /* Likewise, if the full height of the container is not required, the room is	*/
        /* vertically centred.								*/
    }

    // Return { x,y,cx,cy,w,h } for a 'selection'
    //DEBUG need to clarify 'selection'
    getBoundingBox(selection) {
        /* get x,y co-ordinates of top-left of bounding box and width and height */
        var element = selection.node();
        return this.box(element);
    }

    // Return { x,y,cx,cy,w,h } for an html DOM element (for us often SVG)
    box(element) {
        //console.log('box called with element', element);
        var bbox = element.getBBox();
        var cx = bbox.x + bbox.width / 2;
        var cy = bbox.y + bbox.height / 2;
        //console.log('box bbox=', bbox);
        return {
            x: bbox.x,
            y: bbox.y,
            cx: cx,
            cy: cy,
            w: bbox.width,
            h: bbox.height
        };
    }

    //--------------------------------------------------//
    //----------------------ZOOM end--------------------//
    //--------------------------------------------------//

    point_in_crate(crate_id, point) {
        let polygon = d3.select('#' + crate_id)._groups[0][0].points;
        //A point is in a polygon if a line from the point to infinity crosses the polygon an odd number of times
        let odd = false;
        //For each edge (In this case for each point of the polygon and the previous one)
        for (let i = 0, j = polygon.length - 1; i < polygon.length; i++) {
            //If a line from the point into infinity crosses this edge
            if (((polygon[i].y > point[1]) !== (polygon[j].y > point[1])) // One point needs to be above, one below our y coordinate
                // ...and the edge doesn't cross our Y corrdinate before our x coordinate (but between our x coordinate and infinity)
                &&
                (point[0] < ((polygon[j].x - polygon[i].x) * (point[1] - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x))) {
                // Invert odd
                odd = !odd;
            }
            j = i;

        }
        //If the number of crossings was odd, the point is in the polygon
        return odd;
    };
    //--------------------------------------------------//
    //----------------HEATMAP definition----------------//
    //--------------------------------------------------//

    //temporary solution to create a heatmap
    obtain_sensors_in_crates() {
        //crates will house crate_id/sensors object pairs
        let crates = [];
        //fill the crates array with crate_ids and # of sensors
        d3.selectAll('polygon')._groups[0].forEach(crate => crates.push({
            'crate_id': crate.id,
            'sensors': 0
        }));
        //get the list of sensors by looking at the attached circles
        let sensors = d3.selectAll('circle')._groups[0];

        for (let i = 0; i < crates.length; i++) {
            //select crate
            let crate = crates[i].crate_id;
            //get sensor count for that crate
            crates[i].sensors = this.get_count_for_crate(sensors, crate);
        }
        return crates;
    }

    //looks at a crate and returns the number of sensors in it
    get_count_for_crate(sensors, crate_id) {

        let count = 0;
        //iterate over the sensor (circles) array
        for (let i = 0; i < sensors.length; i++) {

            let sensor = sensors[i];
            //acquire x/y positions for a sensor
            let point = [sensor.cx.baseVal.value, sensor.cy.baseVal.value];
            //if sensor is within a crate
            if (this.point_in_crate(crate_id, point)) {
                count++;
            }

        }
        return count;
    }
    //--------------------------------------------------//
    //----------------HEATMAP end-----------------------//
    //--------------------------------------------------//

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

} // end class VizTools