"use strict"

// NOTE the containing page defines these globals:
// API_BIM  e.g. = "http://ijl20-iot.cl.cam.ac.uk:4123/api/bim/"
// API_SENSORS
// API_READINGS
// API_SPACE
// FLOOR_ID e.g. "FF"

class SpaceFloor {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();
        this.jb_tools = new VizTools2();

        // Transform parameters to scale SVG to screen
        parent.svg_transform = ""; // updated by set_svg_transform()
        this.next_color = 0;
        this.sensor_data; //metadata
        this.sensor_readings = {}; //sensor reading data
        this.sensors_in_crates = {};
    }

    // init() called when page loaded
    init() {
        var parent = this;

        this.viz_tools.init();

        // Page template DOM elements we'll update
        this.page_draw_div = document.getElementById("main_drawing_div");
        this.page_floor_svg = document.getElementById("drawing_svg"); // drawing SVG element
        console.log("page_floor_svg", this.page_floor_svg);
        this.page_coords = document.getElementById("drawing_coords");

        // debug for page x,y coordinates
        this.page_floor_svg.addEventListener('mousemove', function (e) {
            parent.page_coords.innerHTML = e.clientX + "," + e.clientY;
        });

        // object to store BIM data for current floor when returned by BIM api
        this.floor_bim_object = null;
        this.floor_number = 0;
        this.floor_coordinate_system = null;

        //Determines heatmap's color scheme
        this.hue = "g"; /* b=blue, g=green, r=red colours - from ColorBrewer */

        //Breaks the data values into 9 ranges, this is completely arbitrary and
        // can be changed with cat_lim
        this.cat_lim = 9;

        //determines how to color in polygon based on X property (e.g. # sensors)
        this.quantize =
            d3.scaleQuantize()
            .domain([0, this.cat_lim])
            .range(d3.range(this.cat_lim).map(function (i) {
                return parent.hue + i + "-" + parent.cat_lim;
            }));

        //Uses in conjunction with quantize above -> enter crate_id and get associated
        //values with it (e.g. # sensors)
        this.rateById = d3.map();

        //Other global variables

        this.previous_circle_radius = 0; // set on mouse over, used to remember radius for reset on mouse out.
        this.defaultScale = 1; /* default scale of map - fits nicely on standard screen */

        this.set_legend(parent);

        // Do an http request to the SPACE api, and call handle_building_space_data() on arrival
        this.get_floor_crate(parent);


        this.min_max_range = {}
        this.range_offset = 2;

        document.getElementById('show_heatmap').addEventListener('click', () => {
            parent.show_heatmap(parent);
        })

        document.getElementById('reset').addEventListener('click', () => {
            parent.hide_heatmap(parent);
        })

    }

    get_min_max(parent){
        console.log('minmax hello')

        let min = 999;
        let max = -999;

        for (let reading in parent.sensor_readings) {

            let val = parent.sensor_readings[reading].temp;
            if (val > max) {
                max = val;
            }
            if (val < min) {
                min = val;
            }
        }

        parent.min_max_range = {
            max: max,
            min: min
        };
        console.log('minmax', min, max)
    }
    // Use BIM api to get data for this floor
    get_floor_crate(parent) {
        var request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
            var crates_dict = JSON.parse(request.responseText)
            // Note the BIM api returns a dictionary
            parent.handle_floor_crate(parent, crates_dict[CRATE_ID]);
        });
        request.open("GET", API_BIM + "get/" + CRATE_ID + "/0/");
        request.send();
    }

    // Will be called with a crate object when that is returned by BIM api
    handle_floor_crate(parent, crate) {
        console.log("handle_floor_crate got", crate);

        //globals
        parent.floor_bim_object = crate;
        parent.floor_number = crate["acp_location"]["f"];
        parent.floor_coordinate_system = crate["acp_location"]["system"];
        console.log("loaded BIM data for floor", parent.floor_coordinate_system + "/" + parent.floor_number)

        parent.get_floor_svg(parent);
    }

    // We get the SVG for the floor using *floor number* in the "acp_location_xyz" property
    get_floor_svg(parent) {

        var space_api_url = API_SPACE + 'get_floor_number/' +
            parent.floor_coordinate_system + '/' + parent.floor_number + '/';

        console.log('get_floor_svg()', space_api_url);

        var request = new XMLHttpRequest();
        request.overrideMimeType('application/xml');

        request.addEventListener("load", function () {
            var xml = request.responseXML
            parent.handle_floor_svg(parent, xml);
        });

        request.open("GET", space_api_url);
        request.send();
    }

    handle_floor_svg(parent, xml) {
        console.log("handle_floor_svg() loaded floor SVG", xml);
        let scale = 8.3; //DEBUG

        // Parent of the SVG polygons is <g id="bim_request"...>
        let bim_request = xml.getElementById('bim_request');

        // Remove the "floor" or "building" crates from the SVG
        let floors = xml.querySelectorAll('polygon[data-crate_type=floor]');
        floors.forEach(function (el) {
            console.log("moving floor polygon to beginning: " + el.id);
            //el.remove();
            bim_request.prepend(el);
        });
        let buildings = xml.querySelectorAll('polygon[data-crate_type=building]');
        buildings.forEach(function (el) {
            console.log("moving building polygon to beginning: " + el.id);
            bim_request.prepend(el);
        });

        parent.append_svg(parent, xml.querySelector('#bim_request'));

        let polygons = parent.page_floor_svg.querySelectorAll("polygon");

        console.log("handle_floor_svg", polygons.length, "polygons");

        parent.set_svg_transform(parent, polygons);

        // embed the SVG map
        //let svgMap = xml.getElementsByTagName("g")[0]; // set svgMap to root g

        //assign all svg objects to a single global variable
        //parent.floorplan = parent.page_floor_svg.appendChild(svgMap);

        //attach polygon styling
        d3.selectAll("polygon")
            .style("stroke-width", 0.5 / scale)
            .attr("stroke", "black")
            .attr("transform", parent.svg_transform);

        //assign fill colors
        d3.select(parent.page_floor_svg).selectAll("polygon")
            .attr("class", function (d) {
                return parent.quantize_class(parent, parent.quantize(parent.rateById.get(this.id)));
            })
            .append("title").text(function (d) {
                return this.parentNode.id;
            });

        //set mouse events
        d3.select(parent.page_floor_svg).selectAll("polygon")
            .on("mouseover", function (d) {
                d3.select("#" + this.id + "_tr").style("background-color", "#fec44f");

                if (d3.select(this).classed("active"))
                    return; //no need to change class when room is already selected

                d3.select(this).attr("class", "hover");

            })
            .on("mouseout", function (d) {
                d3.select("#" + this.id + "_tr").style("background-color", "whitesmoke");

                if (d3.select(this).classed("active"))
                    return; //no need to change class when room is already selected

                d3.select(this).attr("class", function (d) {
                    // reset room color to quantize range
                    return parent.quantize_class(parent, parent.quantize(parent.rateById.get(this.id)))
                });
            })
            .on('click', function (d) {
                // FLOORSPACE_LINK set in template with "crate_id" string placeholder
                window.location = FLOORSPACE_LINK.replace("crate_id", this.id);
                console.log('CLICKED ON FLOOR_PLAN', d3.select(this))
            });


        // call SENSORS api to get the metadata for sensors on this floor
        parent.get_sensors_metadata(parent);
    }

    // Add the svg objects to the DOM parent SVG (but invisible)
    append_svg(parent, svg) {
        // note viz_tools.box returns ZEROs if used before the appendChild()
        //console.log("box before render", parent.viz_tools.box(floor_svg));
        var page_svg = parent.page_floor_svg.appendChild(svg);

        // Now we've done the appendChild we can work out the bounding box and the scale
        //make invisible prior loading
        //d3.select(page_svg).style("opacity", 0);
    }

    // Append each floor to page SVG but keep invisible for now
    // After appending the floor SVG's, we will calculate the scale & xy transform
    set_svg_transform(parent, polygons) {
        let min_x = 99999;
        let max_x = -99999;
        let min_y = 99999;
        let max_y = -99999;

        polygons.forEach(function (polygon) {
            // Get bounding box of floor polygon
            let box = parent.viz_tools.box(polygon);
            // Update max width, height found so far
            if (box.x < min_x) min_x = box.x;
            if (box.x + box.w > max_x) max_x = box.x + box.w;
            if (box.y < min_y) min_y = box.y;
            if (box.y + box.h > max_y) max_y = box.y + box.h;
            //console.log("box", box);
        });
        console.log("box min_x:", min_x, "min_y:", min_y, "max_x", max_x, "max_y", max_y);
        // calculate appropriate scale for svg
        let w = parent.page_floor_svg.clientWidth;
        let h = parent.page_floor_svg.clientHeight;

        let x_scale = w / (max_x - min_x);
        let y_scale = h / (max_y - min_y);

        // Set the svg scale to fit either x or y
        let svg_scale = x_scale < y_scale ? x_scale : y_scale;
        // x offset
        let svg_x = -min_x * svg_scale;
        let svg_y = -min_y * svg_scale;
        parent.svg_transform = "translate(" + svg_x + "," + svg_y + ") " +
            "scale(" + svg_scale + ")";
        console.log("svg_transform", parent.svg_transform);
    }

    //toggles the sidebar with crate_id/sensor pairs on the right
    show_rooms() {
        if (document.getElementById("table_content").style.display === "none") {
            document.getElementById("table_content").style.display = "block"
        } else {
            document.getElementById("table_content").style.display = "none";
        }

    }

    change_floor(floor) {
        window.location = '/wgb/floor/' + floor
    }

    /*
    //DEBUG this API is not yet properly implemented
    async function fetch_sensors_counts(crate_id) {
        //Fetches csv data async, soon to be replaced by d3.json()
        var sensor_count_url = API_SENSORS + "get_count/" + crate_id+'/1'
        console.log(sensor_count_url)

        var incoming = await d3.json(sensor_count_url)
        var data = incoming['data']
        //data = await d3.csv("/static/data/" + dataset + "_BIM_data.csv");
    }
    */

    // Get the metadata from the SENSORS api for the sensors on this floor
    get_sensors_metadata(parent) {
        var request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
            var sensors_data = JSON.parse(request.responseText)
            parent.sensor_data = sensors_data["sensors"];
            parent.handle_sensors_metadata(parent, sensors_data["sensors"]);
        });
        // Using globals from floor BIM crate object retrieved earlier:
        //   floor_coordinate_system
        //   floor_number
        // call /api/sensors/get_floor_number/<coordinate_system>/<floor_number>/
        var sensors_api_url = API_SENSORS + "get_floor_number/" +
            parent.floor_coordinate_system + "/" + parent.floor_number + '/';

        console.log("get_sensors_metadata() ", sensors_api_url);
        request.open("GET", sensors_api_url);
        request.send();
    }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, results) {
        console.log("handle_sensors_metadata() loaded", results);

        //declare circle properties - opacity and radius
        let opac = 0.5;
        let rad = 0.5; // radius of sensor icon in METERS (i.e. XYZF before transform)

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in results) {
            try {
                // Create API url for sensor reading AND metadata
                let readings_url = API_READINGS + 'get/' + sensor + '/?metadata=false';
                console.log('sensor fetching', readings_url)

                d3.json(readings_url, {
                    crossOrigin: "anonymous"
                }).then(function (received_data) {
                    console.log('tooltips() raw', received_data)
                    let reading = received_data["reading"];

                    let reading_obj = '';

                    if (received_data['acp_error_msg'] != undefined) {
                        let error_id = received_data['acp_error_id'];
                        console.log('handle_readings() error', received_data);
                        reading_obj = 'NO READINGS available for this sensor.';
                    } else {
                        let readings = received_data["reading"];

                        try {
                            if (readings.payload_cooked.temperature != undefined) {
                                parent.sensor_readings[sensor] = {
                                    temp: readings.payload_cooked.temperature, //temperature humidity
                                    acp_id: sensor,
                                    crate_id: parent.sensor_data[sensor].crate_id
                                };
                            }
                        } catch (error) {

                        }

                        // //exrtact all features with ranges --needed for mouseover viz
                        // let all_features = sensor_metadata['acp_type_info']['features'];
                        // reading_obj = readings;
                    }
                    let msg = typeof (reading_obj) == 'string' ? reading_obj : '';

                    console.log('gottem', msg)

                    parent.get_min_max(parent);

                });


                let x_value = results[sensor]['acp_location_xyz']['x']
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['acp_location_xyz']['y']
                let floor_id = results[sensor]['acp_location_xyz']['f']
                let sensor_id = results[sensor]['acp_id'];

                d3.select("#bim_request").append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("r", rad)
                    .attr("id", sensor_id)
                    .style("opacity", opac)
                    .style("fill", "purple")
                    .attr("transform", parent.svg_transform);

            } catch (error) {
                console.log(error)
            }

        }
        parent.viz_tools.tooltips();
        parent.get_floor_heatmap(parent);
    }

    get_floor_heatmap(parent) {

        let sensors_in_crates = parent.viz_tools.obtain_sensors_in_crates();
        parent.sensors_in_crates = parent.viz_tools.obtain_sensors_in_crates();
        //map crates with sensors so that rateById.get(CRATE) returns #sensors
        d3.map(sensors_in_crates, function (d, i) {
            parent.rateById.set(d.crate_id, d.sensors)
        });

        console.log(sensors_in_crates)
        //quantize polygons again according to sensors in them
        d3.selectAll("polygon")
            .attr("class", function (d) {
                return parent.quantize_class(parent, parent.quantize(parent.rateById.get(this.id)));
            })

        //since we have the data preloaded might as well add
        //tabs with to make life easier (temporary solution ofc)
        parent.viz_tools.tabulate(sensors_in_crates, ["crate_id", "sensors"]); //render the data table

        //make invisible as default, so that users can access upon clicking on the 'sidebar'
        document.getElementById("table_content").style.display = "none";

    }

    show_heatmap(parent) {
        // d3.selectAll('polygon').style('fill', 'white')
        d3.selectAll('polygon').attr('class', 'g0-9')


        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.page_floor_svg.clientHeight;
        let w = parent.page_floor_svg.clientWidth;
        let bbox = d3.select('#bim_request').node().getBoundingClientRect();

        // Build color scale
        // var myColor = d3.scaleLinear()
        //     .range(["white", "#69b3a2"])
        //     .domain([1, 100])

        var myColor2 = d3.scaleLinear()
            .range(["red", "blue"])
            .domain([0, 7])

        let yoff = 0;

        let floor = document.querySelector("[data-crate_type='floor']");
        let border = d3.select(floor).node().getBoundingClientRect()
        let points = floor.points;



        //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
        let scale = floor.transform.baseVal.consolidate().matrix.a
        let counter = 0;
        console.log('scale', scale)

        let sensor_list = Object.keys(parent.sensor_readings);
        let crates_with_sensors = {};
        let crates_with_sensors_list = [];

        for (let j = 0; j < sensor_list.length; j++) {
            if (crates_with_sensors[parent.sensor_readings[sensor_list[j]].crate_id] == undefined) {
                crates_with_sensors[parent.sensor_readings[sensor_list[j]].crate_id] = [];
                crates_with_sensors[parent.sensor_readings[sensor_list[j]].crate_id].push(parent.sensor_readings[sensor_list[j]]);
            } else {
                crates_with_sensors[parent.sensor_readings[sensor_list[j]].crate_id].push(parent.sensor_readings[sensor_list[j]]);
            }
        }
        crates_with_sensors_list = Object.keys(crates_with_sensors);


        console.log('crates with sensor', crates_with_sensors)

        let rect_count = 0;

        var sequentialScale = d3.scaleSequential()
            .domain([0, .5])
            .interpolator(d3.interpolateRainbow);

        var linearScale = d3.scaleLinear()
            .range(['yellow', 'red']);

        var powerScale = d3.scalePow()
            .exponent(5)
            .domain([0, 1])
            .range(['yellow', 'red']);

        var myColor;
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

                let step = 10;
                let offset = 0;
                //console.log(bbox, bbox.width, polygon_points, [pol_h, pol_w, pol_top, pol_left])
                counter++;

                console.log('crates with sensors')

                for (let i = pol_left; i < pol_w + pol_left; i += step) {
                    for (let u = pol_top; u < pol_h + pol_top; u += step) {
                        rect_count++;
                        let coords = {
                            'x': i / scale,
                            'y': u / scale,
                            'height': h,
                            'width': w
                        };

                        if (parent.inside(coords, polygon_points)) {

                            let selected_crate = element.id;
                            let loc = {
                                x: i - step / 2,
                                y: u - step / 2,
                                scale: scale
                            }

                            let min = parent.min_max_range.min;
                            let max = parent.min_max_range.max;

                            myColor = d3.scaleSequential(d3.interpolateInferno)
                                .domain([min, max]);
                            let color = myColor(parent.getHeatmap(parent, selected_crate, loc, crates_with_sensors));


                            main_svg
                                .append("rect")
                                .style('pointer-events', 'none')
                                .attr('class', class_name)

                                .attr("x", function (d) {
                                    return loc.x
                                })
                                .attr("y", function (d) {
                                    return loc.y
                                })
                                .attr("width", step - offset)
                                .attr("height", step - offset)
                                .style('opacity', 0)
                                //.style("fill", 'pink')
                                
                                .transition() // <------- TRANSITION STARTS HERE --------
                                .delay(function (d, i) {
                                    return rect_count * 2;
                                })
                                .duration(1000)

                                .style("fill", function (d) {
                                    return color
                                })

                                .style('opacity', 0.75);
                        }
                    }
                }

                //  console.log(counter)
            }


        })

        parent.set_colorbar(parent, myColor)

    }

    hide_heatmap(parent) {
        parent.get_floor_heatmap(parent)
        d3.selectAll('#heatmap').remove();

    }
    getHeatmap(parent, crate, coords, crate_list) {
        //console.log("new call");

        let rect_loc = coords;
        let scale = coords.scale
        //console.log('heatmap says hi', parent.sensor_data,sens_readings,crate)

        // console.log(crate, coords)
        let sensor_loc = {};
        let col = 0;
        let sens_readings = parent.sensor_readings;

        let sensor_list = Object.keys(sens_readings);
        let sensor_list_len = sensor_list.length

        //console.log(crate_list, crate,sens_readings)

        let sensor_crates = {};
        let combined_dist;
        let data_points = [];

        combined_dist = 0;
        data_points = [];

        console.log('CRATE passed', crate, crate_list[crate]);
        let count = 0;
        crate_list[crate].forEach(sensor => {

            console.log(count++, sensor.acp_id, sensor.temp)


            let x_value = parent.sensor_data[sensor.acp_id]['acp_location_xyz']['x'];
            let y_value = -parent.sensor_data[sensor.acp_id]['acp_location_xyz']['y'];

            sensor_loc = {
                x: x_value * scale,
                y: y_value * scale
            };

            let dist = parent.dist(sensor_loc, rect_loc)

            let data_point = {
                'sensor': sensor.acp_id,
                'value': sensor.temp,
                'dist': dist
            };
            data_points.push(data_point);

            col += (dist * (sensor.temp))

            combined_dist += dist;


        })
        let final_val = 0;
        //  console.log('cd',combined_dist)
        console.log('calculating new data points', data_points)

        data_points.forEach(points => {

            let percentile = points.dist / combined_dist;

            if (points.dist != combined_dist) {
                
                let pre_final=1 - percentile;
                let additive_value=points.value * pre_final;
                final_val += additive_value;

                console.log(points.value, "*(1-(", points.dist, "/", combined_dist, "))", 'perc', Math.round(pre_final*100)+"%",'additive',additive_value)
                console.log('final add prev',Math.round(final_val),Math.round(additive_value),Math.round(final_val-additive_value))

            } else {
                final_val = points.value;
                console.log('single sensor')
            }


        })

        console.log('sensor final val',final_val)

        col = col / combined_dist;

        return final_val; // myColor(Math.floor(Math.random()*100))
    }

    dist(loc_one, loc_two) {
        let x1 = loc_one.x;
        let y1 = loc_one.y;

        let x2 = loc_two.x;
        let y2 = loc_two.y;

        return Math.hypot(x2 - x1, y2 - y1)
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

    quantize_class(parent, polygon_id) {

        var quantized_class = polygon_id
        if (quantized_class == undefined) {
            return parent.quantize(0)
        } else {
            return polygon_id;
        }
    }

    set_colorbar(parent, colorScale) {
        d3.select("#legend_svg").remove();

        //configure canvas size and margins, returns and object
        //(width, height,top, right, bottom, left)
        let c_conf = parent.jb_tools.canvas_conf(110, 320, 10, 5, 10, 5);
        //create a canvas with predefined settings
        parent.legend_svg = parent.jb_tools.make_canvas(c_conf, '#legend_container', "translate(" + c_conf.left + "," + c_conf.top + ")");

        // var colorScale = d3.scaleSequential(d3.interpolateWarm)
        //     .domain([parent.min_max_range.min, parent.min_max_range.max])

        // var colorScale = d3.scaleLinear()
        //     .domain([parent.min_max_range.min, parent.min_max_range.max])
        //     .range(['yellow', 'red']);


        var scale = d3.scaleLinear().domain([0, c_conf.height]).range([parent.min_max_range.min, parent.min_max_range.max]);
        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([0, c_conf.height]);



        // append the svg object to the body of the page
        let x_bar_offset = 15;
        let x_range_offset = -8;

        let mapped_value = 50 //parseInt(this.map_values(raw_value, feature.range[0], feature.range[1], 0, c_conf.width));

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = parent.legend_svg.selectAll(".bars")
            .data(d3.range(0, c_conf.height), function (d) { //c_conf.width c_conf. parent.min_max_range.min, parent.min_max_range.max
          //      console.log(d)
                return d;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .attr("y", function (i) {
                return i;
            })
            .attr("x", 10)

            .attr("height", 1)
            .attr("width", c_conf.width / 4)

            .style("fill", function (d, i) {
                //if the i'th element is the same as the mapped reading value, draw a black line instead

                if (i == mapped_value) {
                    return 'black'
                } else return colorScale(scale(d));
            });

        //text showing range on left/right
        //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
        parent.jb_tools.add_text(parent.legend_svg, parent.min_max_range.max, c_conf.width / 2, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(parent.legend_svg, parent.min_max_range.min, c_conf.width / 2, scale_inv(parent.min_max_range.min), "0.75em", "translate(0,0)") // 0 is the offset from the left

        let mapped_max = scale_inv(parent.min_max_range.max + parent.range_offset)
        let mapped_min = scale_inv(parent.min_max_range.min - parent.range_offset)


        parent.jb_tools.add_text(parent.legend_svg, parent.min_max_range.max + parent.range_offset, c_conf.width / 2, mapped_max, "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(parent.legend_svg, parent.min_max_range.min - parent.range_offset, c_conf.width / 2, mapped_min, "0.75em", "translate(0,0)") // 0 is the offset from the left

    }
    //----------------------------------------------//
    //--------------LEGEND definition---------------//
    //----------------------------------------------//
    set_legend(parent) {

        d3.select("#legend_svg").remove();

        //Defines legend container size, appends it
        parent.legend_svg = d3.select("#legend_container")
            .append("svg")
            .attr("id", "legend_svg")
            .style("width", 100)
            .style("height", 300);

        /* Thanks to http://stackoverflow.com/users/3128209/ameliabr for tips on creating a quantized legend */
        parent.legend = parent.legend_svg.selectAll('g.legendEntry')
            .data(this.quantize.range())
            .enter()
            .append('g').attr('class', 'legendEntry');

        //Adds small rectangles to the legend
        parent.legend
            .append('rect')
            .attr("x", 20)
            .attr("y", function (d, i) {
                return i * 25 + 20;
            })
            .attr("width", 15)
            .attr("height", 15)
            .attr("class", function (d) {
                return d;
            })
            .style("stroke", "black")
            .style("stroke-width", 1)

            //Makes legend rectangles interactive:
            //mouse commands, rectangles are clickable

            .on("mouseover", function (d) {
                d3.select(this).style("stroke", "orange");
            })
            .on("mouseout", function (d) {
                d3.select(this).style("stroke", "black");
            })
            .on("click", function (d) {
                // Highlights selected rooms
                d3.select(floorplan)
                    .selectAll('.' + d)
                    .transition()
                    .duration(1000)
                    .attr("class", "highlight")
                    .on('end', function () {
                        //reclass to previous colors
                        d3.selectAll("polygon")
                            .attr("class", function (d) {
                                return quantize_class(parent, parent.quantize(parent.rateById.get(this.id)));
                            });
                    });

            });

        //Adds text to legend to show the extent
        parent.legend
            .append('text')
            .attr("x", 40) //leaves space after the <rect>
            .attr("y", function (d, i) {
                return i * 25 + 20;
            })
            .attr("dy", "0.8em") //place text one line *below* the x,y point
            .text(function (d, i) {
                var extent = parent.quantize.invertExtent(d);
                //extent will be a two-element array, format it however you want:
                return (extent[0] == 1 ? (extent[0] + ' sensor') : (extent[0] + ' sensors')) //+ " - " + extent[1]
            })
            .style("font-family", "sans-serif")
            .style("font-size", "10px");
    } // end set_legend

} // end class SpaceFloor