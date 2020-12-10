"use strict"

class HeatMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();
        this.jb_tools = new VizTools2();

        this.sensor_data; //metadata
        this.sensor_readings = {}; //sensor reading data
        this.sensors_in_crates = {};

    }

    // init() called when page loaded
    init() {

        var parent = this;
        this.viz_tools.init();

        this.min_max_range = {}
        this.range_offset = 2;

        // document.getElementById('show_heatmap').addEventListener('click', () => {

        //     parent.show_heatmap(parent);
        // })

        // document.getElementById('reset').addEventListener('click', () => {
        //     parent.hide_heatmap(parent);
        // })
    }

   
    // Get the metadata from the SENSORS api for the sensors on this floor
    get_sensors_metadata(parent) {
        var request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        //https://tfc-app9.cl.cam.ac.uk/api/readings/get_floor_feature/WGB/1/co2/?metadata=true
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
                let readings_url = 'https://tfc-app9.cl.cam.ac.uk/api/readings/get_feature/' + sensor + '/temperature/' //elsys-eye-048163
                //API_READINGS + 'get/' + sensor + '/?metadata=false';
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

                 //   parent.get_min_max(parent);

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


    get_min_max(parent) {
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

    show_heatmap(parent) {
        // d3.selectAll('polygon').style('fill', 'white')
        d3.selectAll('polygon').attr('class', 'g0-9')


        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.page_floor_svg.clientHeight;
        let w = parent.page_floor_svg.clientWidth;
      
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

                            let cell_value = parent.get_heatmap(parent, selected_crate, loc, crates_with_sensors);
                            let color = myColor(cell_value);


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
                                .attr("width", step - offset)
                                .attr("height", step - offset)
                                .style('opacity', 0)
                                //.style("fill", 'pink')
                                .attr('data-value', cell_value)
                                .on("mouseover", function (d) {
                                    let cell_temp = this.dataset.value;
                                    console.log(cell_temp)
                                    parent.set_cbar_value(parent, cell_temp)
                                })
                                .on("mouseout", function (d) {
                                    d3.select('#hover_val').remove();
                                })

                                .transition() // <------- TRANSITION STARTS HERE --------
                                .delay(function (d, i) {
                                    return rect_count * 2;
                                })
                                .duration(1000)

                                .style("fill", function (d) {
                                    return color
                                })
                                .style('opacity', 0.75)


                        }
                    }
                }

                //  console.log(counter)
            }


        })

        parent.set_colorbar(parent, myColor)

    }

    hide_heatmap(parent) {
        parent.get_floor_heatmap(parent);

        d3.selectAll('#heatmap').remove();
        d3.selectAll('circle').style('opacity', 0.5);
        parent.set_legend(parent)

    }
    get_heatmap(parent, crate, coords, crate_list) {

        let rect_loc = coords;
        let scale = coords.scale

        let sensor_loc = {};

        let combined_dist;
        let data_points = [];

        combined_dist = 0;
        data_points = [];

        crate_list[crate].forEach(sensor => {

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
            combined_dist += dist;


        })

        let final_val = 0;

        let C = 0;
        let D = 0;
        data_points.forEach(points => {

            if (points.dist != combined_dist) {

                let B = 0;

                data_points.forEach(points2 => {
                    B += combined_dist / points2.dist;
                });

                let A = combined_dist / points.dist;

                C = A * (1 / B) * points.value;

                D += C;

            } else {
                final_val = points.value;
            }

        })

        return D == 0 ? final_val : D; // myColor(Math.floor(Math.random()*100))
    }

    
    set_cbar_value(parent, value) {
        let c_conf = parent.jb_tools.canvas_conf(110, 320, 10, 5, 10, 5);

        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height,0]);
        let target_svg = d3.select("#legend_svg");
 
        target_svg.append('g')
            .attr('id', 'hover_val')
            .append('rect')
            .attr("y", function (d) {
                return scale_inv(value)
            })
            .attr("x", 10)
            .attr("width", c_conf.width / 4)
            .attr("height", 2.5)
            .style("fill", 'green');

let rounded_val=Math.round( value * 100 + Number.EPSILON ) / 100

        parent.jb_tools.add_text(d3.select("#hover_val"), rounded_val, 60, scale_inv(value), "0.65em", "translate(0,0)") // 0 is the offset from the left

    }

    set_colorbar(parent, colorScale) {
        d3.select("#legend_svg").remove();
        d3.selectAll('circle').style('opacity', 0);


        //configure canvas size and margins, returns and object
        //(width, height,top, right, bottom, left)
        let c_conf = parent.jb_tools.canvas_conf(110, 320, 10, 5, 10, 5);

        parent.legend_svg = d3.select('#legend_container')
            .append("svg")
            .attr("width", c_conf.width + c_conf.left + c_conf.right)
            .attr("height", c_conf.height + c_conf.top + c_conf.bottom)
            .attr('id', "legend_svg");


        var scale = d3.scaleLinear().domain([c_conf.height,0]).range([parent.min_max_range.min, parent.min_max_range.max]);
        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height,0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = parent.legend_svg.selectAll(".bars")
            .data(d3.range(0, c_conf.height), function (d) {
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
                console.log(colorScale(scale(d)), scale(d), d);
                return colorScale(scale(d));
            });


        //text showing range on left/right
        //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
        parent.jb_tools.add_text(parent.legend_svg, parent.min_max_range.max, c_conf.width / 2, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(parent.legend_svg, parent.min_max_range.min, c_conf.width / 2, scale_inv(parent.min_max_range.min), "0.75em", "translate(0,0)") // 0 is the offset from the left

    }

}