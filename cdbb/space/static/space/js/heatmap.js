"use strict"

class HeatMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        this.master = floorspace;

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();
        this.jb_tools = new VizTools2();

        this.sensor_data = {}; //sensor data+location required to draw the heatmap
        this.crates_with_sensors = {}; //sensor data saved per crate

        this.animation_dur = 350;

        this.rect_size = 7;

        // this.sensor_readings = {}; //sensor reading data
        // this.sensors_in_crates = {};

    }

    // init() called when page loaded
    init() {

        var parent = this;
        parent.viz_tools.init();

        parent.min_max_range = {}
        parent.color_scheme = d3.scaleSequential(d3.interpolateInferno)
        parent.animation_delay = d3.scaleLinear().range([3000, 1000]);

        //parent.get_floor_sensors(parent);
        parent.get_local_sensors(parent);

        document.getElementById('features_list').addEventListener('change', function () {
            console.log('You selected: ', this.value);

            parent.redraw_heatmap(parent, this.value)

        });

    }

    update_sensor(parent, acp_id, payload) {

    }

    get_floor_sensors(parent) {

        let system = parent.master.floor_coordinate_system;
        let floor = parent.master.floor_number;
        let feature = 'temperature';

        let readings_url = "https://tfc-app9.cl.cam.ac.uk/api/readings/get_floor_feature/" + system + "/" + floor + "/" + feature + "/" + "?metadata=true";
        console.log('heatmap url', readings_url)
        d3.json(readings_url, {
            crossOrigin: "anonymous"
        }).then(function (received_data) {
            console.log('heatmap received', received_data)
            parent.handle_sensors_metadata(parent, received_data)
        });

    }

    // Alternative to get_readings() using local file for sensors API response
    get_local_sensors(parent) {
        console.log('loading data')

        d3.json("http://localhost:6969/VLAB_JSON.json",{
            crossOrigin: "anonymous"
            
        }).then(function (received_data) {
            console.log('heatmap received', received_data)
            parent.handle_sensors_metadata(parent, received_data)

        });
    }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, results) {
        console.log("handle_sensors_metadata() loaded", results);

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in results['sensors']) {

            try {
                parent.sensor_data[sensor] = {
                    'acp_id': sensor,
                    'location': results['sensors'][sensor].acp_location_xyz,
                    'crate_id': results['sensors'][sensor].crate_id,
                    'payload': results['readings'][sensor].payload_cooked,
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


    get_min_max(parent, feature) {
        console.log('minmax hello')

        let min = 999;
        let max = -999;

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

        parent.min_max_range = {
            max: max,
            min: min
        };

        //reset min_max values
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);
        parent.animation_delay.domain([parent.min_max_range.min, parent.min_max_range.max]);

        console.log('minmax', min, max)

    }
    //redraw heatmap based on new feature
    redraw_heatmap(parent, feature) {
        parent.get_min_max(parent, feature)
        parent.set_colorbar(parent);

        let index = 0;


        Object.keys(parent.crates_with_sensors).forEach(sensor => {
            let class_id = sensor + "_rect";
            d3.selectAll("." + class_id).nodes().forEach(node => {


                let raw_loc = node.dataset.loc.split(',')
                let selected_crate = node.dataset.crate;

                let loc = {
                    x: parseFloat(raw_loc[0]),
                    y: parseFloat(raw_loc[1]),
                    scale: parseFloat(raw_loc[2])
                }

                let cell_value = parent.get_heatmap(parent, selected_crate, loc);

                let color = parent.color_scheme(cell_value);


                d3.select(node)

                    .attr('data-crate', selected_crate)
                    .attr('data-loc', [loc.x, loc.y, loc.scale])
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
                    .style('opacity', 0.75)


            })

        })




    }
    //first time generating heatmap
    show_heatmap(parent) {
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

                let really_done = false;
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

                            let cell_value = parent.get_heatmap(parent, selected_crate, loc);
                            let color = parent.color_scheme(cell_value);


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

                                // .style('stroke',function (d) {
                                //     return color
                                // })
                                // .style('stroke-width', 0.1)
                                .style('stroke-opacity', 0)
                                .attr('data-crate', selected_crate)
                                .attr('data-loc', [loc.x, loc.y, loc.scale])
                                .attr('data-type', selected_feature)
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

                                    //let delay=Math.random() * (4000 - 1500) + 1500;
                                    let delay = parent.animation_delay(cell_value);
                                    return delay;
                                })
                                .duration(parent.animation_dur)
                                .style("fill", function (d) {
                                    return color
                                })
                                .style('opacity',0.75)


                        }
                    }

                }

                //  console.log(counter)
            }


        });

         //declare circle properties - opacity and radius
         let opac = 1;
         let rad = 4; // radius of sensor icon in METERS (i.e. XYZF before transform)
 
         //iterate through results to extract data required to show sensors on the floorplan
         let results= parent.sensor_data;
         console.log(results)
         for (let sensor in results) {
             try {
                 console.log(sensor)
                 console.log(results[sensor])
                 console.log(results[sensor]['location'])
                 let x_value = results[sensor]['location']['x']*scale
                 // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                 let y_value = -results[sensor]['location']['y']*scale
                 let floor_id = results[sensor]['location']['f']*scale
                 let sensor_id = results[sensor]['acp_id'];
 
                 main_svg.append("circle")
                     .attr("cx", x_value)
                     .attr("cy", y_value)
                     .attr("r", rad)
                     .attr("id", sensor_id)
                     .style("opacity", 1)
                     .style("fill", "lime")
                   //  .attr("transform", parent.master.svg_transform);
 
             } catch (error) {
                 console.log(error)
             }
 
         }

        //debug only, "parent" now working somehow
        this.set_colorbar(parent);

        console.log('done', Date.now())

    }

    hide_heatmap(parent) {
        d3.selectAll('#heatmap').remove();
        d3.selectAll('.non_heatmap_circle').style('opacity', 0.5);

        parent.master.get_floor_heatmap(parent);
        parent.master.set_legend(parent)
    }

    get_heatmap(parent, crate, coords) {

        let feature = document.getElementById('features_list').value;

        let rect_loc = coords;
        let scale = coords.scale

        let sensor_loc = {};

        let combined_dist;
        let data_points = [];

        combined_dist = 0;
        data_points = [];

        parent.crates_with_sensors[crate].forEach(sensor => {

            //if the sensor does not have the requested feature, skip it
            if (sensor.payload[feature] == undefined) {
                return 0
            }

            let x_value = parent.sensor_data[sensor.acp_id]['location']['x'];
            let y_value = -parent.sensor_data[sensor.acp_id]['location']['y'];

            sensor_loc = {
                x: x_value * scale,
                y: y_value * scale
            };

            let dist = parent.jb_tools.dist(sensor_loc, rect_loc)

            let data_point = {
                'sensor': sensor.acp_id,
                'value': sensor.payload[feature],
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

        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height, 0]);
        let target_svg = d3.select("#legend_svg");

        target_svg.append('g')
            .attr('id', 'hover_val')
            .append('rect')
            .attr("y", function (d) {
                return scale_inv(value)
            })
            .attr("x",c_conf.width / 3)
            .attr("width", c_conf.width / 4)
            .attr("height", 2.5)
            .style("fill", 'lime');

        let rounded_val = Math.round(value * 100 + Number.EPSILON) / 100

        parent.jb_tools.add_text(d3.select("#hover_val"), rounded_val, (c_conf.width / 3)+50, scale_inv(value), "0.65em", "translate(0,0)") // 0 is the offset from the left

    }

    set_colorbar(parent) {
        d3.select("#legend_svg").remove();
        d3.selectAll('.non_heatmap_circle').style('opacity', 0);


        //configure canvas size and margins, returns and object
        //(width, height,top, right, bottom, left)
        let c_conf = parent.jb_tools.canvas_conf(110, 320, 20, 5, 20, 5);

        parent.master.legend_svg = d3.select('#legend_container')
            .append("svg")
            .attr("width", c_conf.width + c_conf.left + c_conf.right)
            .attr("height", c_conf.height + c_conf.top + c_conf.bottom)
            .attr('id', "legend_svg");


        var scale = d3.scaleLinear().domain([c_conf.height, 0]).range([parent.min_max_range.min, parent.min_max_range.max]);
        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height, 0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = parent.master.legend_svg.selectAll(".bars")
            .data(d3.range(0, c_conf.height), function (d) {
                return d;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .attr("y", function (i) {
                return 20+i;
            })
            .attr("x", c_conf.width / 3)

            .attr("height", 1)
            .attr("width", c_conf.width / 4)

            .style("fill", function (d, i) {
                return parent.color_scheme(scale(d));
            });


        //text showing range on left/right
        //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.max, (c_conf.width / 2)-3, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.min, (c_conf.width / 2)-3, scale_inv(parent.min_max_range.min)+25, "0.75em", "translate(0,0)") // 0 is the offset from the left

        parent.jb_tools.add_text(parent.master.legend_svg, document.getElementById('features_list').value, (c_conf.width / 2)-220, scale_inv(parent.min_max_range.min)-265, "0.85em", "rotate(-90)") // 0 is the offset from the left

    }

}