"use strict"

class HeatMap {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(floorspace) {

        //throughout the class the master is the main visualisation, parent is HeatMap
        this.master = floorspace;

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();

        //a set of useful d3 functions
        this.jb_tools = new VizTools2();

        //sensor data+location required to draw the heatmap
        this.sensor_data = {};

        //sensor data saved per crate
        this.crates_with_sensors = {};

        //resolution
        this.rect_size = 6;

        //heatmap opacity
        this.default_opacity = 0.75;
        this.sensor_opacity = 0.1;

    }

    // init() called when page loaded
    init() {

        var parent = this;
        parent.viz_tools.init();

        //declare the min max range of values for temp/co2/humidity - will change during runtime
        parent.min_max_range = {}

        //declare the main colorscheme for the heatmap
        parent.color_scheme = d3.scaleSequential(d3.interpolateInferno)

        //total time to draw transitions between activating the heatmap
        parent.animation_dur = 350;
        //the delay for drawing individual items during the animation
        parent.animation_delay = d3.scaleLinear().range([3000, 1000]);

        //Use get_floor_sensors for the API calls, get_local_sensors for faked offline data
        //parent.get_floor_sensors(parent);
        parent.get_local_sensors(parent);

        //attach and event listener to the list of properties
        document.getElementById('features_list').addEventListener('change', function () {
            console.log('You selected: ', this.value);
            parent.redraw_heatmap(parent, this.value)
        });

    }
    //Generates the heatmap;
    //It is attached to an event listener on the template *heatmap* button 
    show_heatmap(parent) {
        parent.show_heatmap_original(parent)
        //parent.show_heatmap_alt(parent)
    }


    //callback to update sensors (for faked sensor data)
    update_callback(parent, sensor, walk) {
        parent.update_sensor(parent, sensor, walk);
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    update_sensors(parent) {
        console.log(parent.sensor_data)
        for (let sensor in parent.sensor_data) {
            console.log('incoming update ', sensor)
            let wildcard = Math.random() < 0.5;
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(20000, 20000 * 10), parent, sensor, wildcard);
        }
    }

    //show fake path
    fake_path(parent) {
        let sens_list = [
            "elsys-fake-738bf2",
            "elsys-fake-d6a9de",
            "elsys-fake-372c9d",
            "elsys-fake-290265",
            "elsys-fake-9354d3",
            "elsys-fake-f3b577",
            "elsys-fake-ffdfb4",
            "elsys-fake-c3e668",
            "elsys-fake-6bf9d0",
            "elsys-fake-1fd377",
            "elsys-fake-c7cf58",
            "elsys-fake-56f2e8",
            "elsys-fake-8bae37",
            "elsys-fake-2c9683"
        ];

        let counter = 1;
        for (let i = 0; i < sens_list.length; i++) {
            let sensor = sens_list[i];
            console.log('incoming update ', sensor)
            window.setTimeout(parent.update_callback, counter * 1000, parent, sensor, true);
            counter++;
        }
    }

    //Main raindrop function for incoming data:
    //selects a sensor and sets it to update on by creating a raindrop
    update_sensor(parent, acp_id, walk) {

        //get the data from the sensor data variable
        let sensor_data = parent.sensor_data[acp_id];

        //get drawn sensors' location on screen
        let sensor_loc = {
            x: document.getElementById("hm_" + acp_id).getAttribute("cx"),
            y: document.getElementById("hm_" + acp_id).getAttribute("cy")
        }

        //debug location
        //  console.log('sensorloc:', sensor_loc, acp_id, sensor_data)

        //rects in polygons are classed by the crate they're in
        let rect_class = sensor_data.crate_id + "_rect";

        //select all relevant rects
        d3.selectAll("." + rect_class).nodes().forEach(node => {

            //acquire their position from the HTML data-loc property 
            let raw_loc = node.dataset.loc.split(',')
            let selected_crate = node.dataset.crate; //??? should this be sensor_data.crate_id ??? -- to be changed

            //get rect's location on screen
            let rect_loc = {
                x: node.x.animVal.value,
                y: node.y.animVal.value,
                scale: parseFloat(raw_loc[2])
            }

            //recoloring rects -- I don't think it's how it should be implemented, lots of unnecessary recalcultion -- to be changed
            //e.g. this value should clearly be retrieved using node.dataset property that's already in HTML
            let cell_value = parent.get_heatmap(parent, selected_crate, rect_loc);

            let color = parent.color_scheme(cell_value);

            let dist_delay = parent.jb_tools.dist(rect_loc, sensor_loc);

            d3.select(node)
                .style("fill", function (d) {
                    return color
                })
                .transition() // <------- TRANSITION STARTS HERE --------
                .ease(d3.easeCubicIn)

                .delay(function (d, i) {

                    let delay = (((Math.cos(dist_delay / 20) + 1)) * 2);

                    if (delay < 50) {
                        delay = 0;
                    }
                    // console.log('delay', delay, Math.cos(dist_delay), 'dist', dist_delay, loc, sensor_loc)
                    // console.log('delay', delay,dist_delay);

                    return delay
                })
                .duration(200) //250
                .ease(d3.easeCubicIn)

                .style("fill", function (d) {
                    return color //'white'//'white' //color
                })

                .style('opacity', function (d, i) {
                    //let opacity = (((Math.sin(dist_delay / 5) + 1)));

                    let opacity = dist_delay / 100;

                    if (walk) {
                        opacity = dist_delay / 25
                    }
                    //console.log('opacity', opacity,dist_delay);

                    if (opacity > parent.default_opacity) {
                        opacity = parent.default_opacity;
                    }
                    return opacity
                })

                .on('end', function (d, i) {
                    d3.select(node)
                        .transition() // <------- TRANSITION STARTS HERE --------
                        .delay(function (d, i) {

                            let wave_len = 5;
                            let amplitude = 4000;

                            if (walk) {
                                wave_len = 2.5;
                                amplitude = 1000;
                            }
                            let warp_delay = (((Math.cos(dist_delay / wave_len) + 1)) * amplitude) / dist_delay; //dampening function

                            // console.log('warp delay', warp_delay)
                            //since the funciton follow 
                            if (warp_delay > 200) {
                                warp_delay = 200;
                                if (walk) {
                                    warp_delay = 75;
                                }
                            }
                            if (warp_delay < 50) {
                                warp_delay = 0;

                            }
                            return warp_delay

                        })
                        .duration(function (d, i) {
                            if (walk) {
                                return 100
                            } else {
                                return 200
                            }
                        })
                        .ease(d3.easeLinear)

                        .style("fill", function (d) {
                            return color //'red'
                        })
                        .style('opacity', parent.default_opacity)

                })


        });
        parent.update_crate_heatmap(parent, sensor_data.crate_id, acp_id)

        // .on('end', function (d, i) {
        //     parent.update_crate_heatmap(parent, sensor_data.crate_id,acp_id)
        // });

    }

    //API requests to get sensors per crate
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

        console.log('loading local data')

        let selection = CRATE_ID == 'FF' ? 'WGB' : 'VLAB'; //for now leaving the Lockdown Lab away from this

        //local file loading from Django
        d3.json("http://localhost:8000/static_web/js/" + selection + "_JSON.json", {
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

    //calculates value ranges for temp/co2/humidity and other during runtime;
    //recalculations are made whenever a new heatmap is selected
    get_min_max(parent, feature) {

        let min = 999;
        let max = -999;

        //iterate through the data based on requested feature and extract min/max values
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

        //reset the main variable
        parent.min_max_range = {
            max: max,
            min: min
        };

        //reset min_max values for scaling
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);
        parent.animation_delay.domain([parent.min_max_range.min, parent.min_max_range.max]);

        console.log('minmax', min, max)

    }

    update_crate_heatmap(parent, crate_id, sensor_id) {
        //select the rectangles associated with a selected crate
        let class_id = crate_id + "_rect";

        d3.selectAll("." + class_id).nodes().forEach(rect => {

            //acquire their position from the HTML data-loc property 
            let raw_loc = rect.dataset.loc.split(',')
            let selected_crate = rect.dataset.crate; //??? should this be sensor_data.crate_id ??? -- to be changed

            //get rect's location on screen
            let rect_loc = {
                x: parseFloat(raw_loc[0]),
                y: parseFloat(raw_loc[1]),
                scale: parseFloat(raw_loc[2])
            }


            let temp_val = Math.random() * (3 + 3) - 3;
            let current_val=parent.sensor_data[sensor_id].payload.temperature;
            let new_val=temp_val+current_val;

            if(new_val>40 || new_val<-10){
                new_val=current_val;
            }

            //update the reading with a new rand value
            parent.sensor_data[sensor_id].payload.temperature= new_val;

            ///space_floor.heatmap.crates_with_sensors['FE11']

           // console.log(crate_id, sensor_id)
            //recalculate the rect value based on the new feature
            let cell_value = parent.get_heatmap(parent, selected_crate, rect_loc);

            //transform the feature value into a color
            let color = parent.color_scheme(cell_value);

         //   console.log(cell_value, color)

            let feature = 'temperature';
            //update the rect on screen
            d3.select(rect)
                .attr('data-crate', selected_crate)
                .attr('data-loc', [rect_loc.x, rect_loc.y, rect_loc.scale])
                .attr('data-type', feature)
                .attr('data-value', cell_value)
                .on("mouseover", function (d) {
                    parent.set_cbar_value(parent, cell_value)
                })
                .on("mouseout", function (d) {
                    d3.select('#hover_val').remove();
                })
                //    .style('opacity', 0)
                //    .transition() // <------- TRANSITION STARTS HERE --------
                //    .delay(function (d, i) {
                //        let delay = parent.animation_delay(cell_value);
                //        return delay;
                //    })
                //    .duration(parent.animation_dur)
                .style("fill", function (d) {
                    return color
                })
            //  .style('opacity', parent.default_opacity)
        })
    }


    //redraw heatmap based on a selected feature
    redraw_heatmap(parent, feature) {

        //get min/max for the selected feature
        parent.get_min_max(parent, feature)
        //reset the colorbar
        parent.set_colorbar(parent);

        //iterate through all crates that have sensors in them
        Object.keys(parent.crates_with_sensors).forEach(crate_id => {

            //select the rectangles associated with a selected crate
            let class_id = crate_id + "_rect";

            d3.selectAll("." + class_id).nodes().forEach(rect => {

                //acquire their position from the HTML data-loc property 
                let raw_loc = rect.dataset.loc.split(',')
                let selected_crate = rect.dataset.crate; //??? should this be sensor_data.crate_id ??? -- to be changed

                //get rect's location on screen
                let rect_loc = {
                    x: parseFloat(raw_loc[0]),
                    y: parseFloat(raw_loc[1]),
                    scale: parseFloat(raw_loc[2])
                }

                //recalculate the rect value based on the new feature
                let cell_value = parent.get_heatmap(parent, selected_crate, rect_loc);

                //transform the feature value into a color
                let color = parent.color_scheme(cell_value);

                //update the rect on screen
                d3.select(rect)
                    .attr('data-crate', selected_crate)
                    .attr('data-loc', [rect_loc.x, rect_loc.y, rect_loc.scale])
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
                    .style('opacity', parent.default_opacity)
            })
        })
    }

    //used when generating the heatmap for the first time (not redrawing)
    show_heatmap_original(parent) {
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
                                .style('opacity', parent.default_opacity);
                        }
                    }
                }
            }
        });



        //iterate through results to extract data required to show sensors on the floorplan
        let results = parent.sensor_data;
        this.attach_sensors(parent, results, scale)
        console.log('results', results)


        //debug only, "parent" now working somehow
        this.set_colorbar(parent);

        console.log('done', Date.now())

    }

    //first get all rects on a floor, then reiterate for rooms
    show_heatmap_alt(parent) {
        console.log('start alt', Date.now())

        let selected_feature = document.getElementById('features_list').value;
        parent.get_min_max(parent, selected_feature);

        d3.selectAll('polygon').attr('class', 'g0-9')


        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.master.page_floor_svg.clientHeight;
        let w = parent.master.page_floor_svg.clientWidth;

        let floor = document.querySelector("[data-crate_type='floor']");

        console.log('floor', floor)
        //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
        var scale = floor.transform.baseVal.consolidate().matrix.a;
        let transf_x = floor.transform.baseVal.consolidate().matrix.e;
        let transf_y = floor.transform.baseVal.consolidate().matrix.f;

        let bbox = floor.getBBox();

        let polygon_points = floor.points;

        let pol_h = bbox.height * scale;
        let pol_w = bbox.width * scale;
        let pol_top = bbox.y * scale;
        let pol_left = bbox.x * scale;

        let offset = 0;

        //  let rect_count = 0;
        for (let i = pol_left; i < pol_w + pol_left; i += parent.rect_size) {
            for (let u = pol_top; u < pol_h + pol_top; u += parent.rect_size) {

                //  rect_count++;

                let coords = {
                    'x': i / scale,
                    'y': u / scale,
                    'height': h,
                    'width': w
                };

                //check if inside the floor polygon
                if (parent.jb_tools.inside(coords, polygon_points)) {

                    let selected_crate = floor.id;
                    let loc = {
                        x: i - parent.rect_size / 2,
                        y: u - parent.rect_size / 2,
                        scale: scale
                    }

                    let cell_value = 1; //parent.get_heatmap(parent, selected_crate, loc);
                    let color = 'black'; //parent.color_scheme(cell_value);


                    main_svg
                        .append("rect")
                        //.style('pointer-events', 'none')
                        .attr('class', 'unassigned_rect')

                        .attr("x", function (d) {
                            return loc.x
                        })
                        .attr("y", function (d) {
                            return loc.y
                        })
                        .attr("width", parent.rect_size - offset)
                        .attr("height", parent.rect_size - offset)
                        .style('stroke-opacity', 0)
                        .attr('data-crate', selected_crate)
                        .attr('data-loc', [loc.x, loc.y, loc.scale])
                        .attr('data-coords', [coords.x, coords.y])

                        .style("fill", 'black')
                        .style('opacity', 0.5);
                }
            }
        }

        let crates_with_sensors_list = Object.keys(parent.crates_with_sensors);

        //d3.selectAll('polygon').nodes().forEach(element => {

        let polygon_alpha = d3.selectAll('polygon').nodes();
        let polygons = []
        console.log('polygons_total', polygon_alpha.length);

        polygon_alpha.forEach(function (d, i) {
            //  console.log(index, 'space',object)
            let has_sensors = crates_with_sensors_list.includes(d.id);

            if (d.dataset.crate_type != 'building' && d.dataset.crate_type != 'floor' && has_sensors) {
                polygons.push(d)
            }

        });

        console.log('polygons_total', polygons.length, polygons);

        // d3.selectAll('.unassigned_rect').nodes().forEach(rect => {
        let rects = d3.selectAll('.unassigned_rect').nodes();

        console.log('items:', 'rects:', rects.length, 'polygons', polygons.length);

        let last_pick = '';

        //pick a rectangle on screen
        for (let u = 0; u < rects.length; u++) {
            let rect = rects[u];

            let loc_raw = rect.dataset.loc.split(',');

            let loc = {
                x: rect.x.baseVal.value + parent.rect_size / 2,
                y: rect.y.baseVal.value + parent.rect_size / 2,
                scale: parseFloat(loc_raw[2])
            }
            //break;
            //try to fit a polygon
            for (let i = 0; i < polygons.length; i++) {
                let element = polygons[i];

                // if (element.dataset.crate_type != 'building' && element.dataset.crate_type != 'floor' && has_sensors) {

                let class_name = element.id + '_rect';

                let polygon_points2 = element.points;

                let polygon_points_new = [];

                for (let j = 0; j < polygon_points2.length; j++) {
                    polygon_points_new[j] = {
                        'x': null,
                        'y': null
                    };
                    polygon_points_new[j].x = polygon_points2[j].x * scale
                    polygon_points_new[j].y = polygon_points2[j].y * scale
                }

                console.log('checking ', element.id)

                if (parent.jb_tools.inside(loc, polygon_points_new)) {

                    let selected_crate = element.id;

                    let cell_value = parent.get_heatmap(parent, selected_crate, loc);
                    let color = parent.color_scheme(cell_value);

                    d3.select(rect)
                        .attr('class', class_name)
                        .style('opacity', 0)
                        .style('stroke-opacity', 0)
                        .attr('data-crate', selected_crate)
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

                            let delay = Math.random() * (2000 - 750) + 750;
                            //let delay = parent.animation_delay(cell_value);
                            return delay;
                        })
                        .duration(parent.animation_dur)
                        .style("fill", function (d) {
                            return color //'red'
                        })
                        .style('opacity', parent.default_opacity);
                } else {
                    console.log('no', 'next polygon');
                    //break;
                }
            }
        }
        console.log('done polygons')


        //iterate through results to extract data required to show sensors on the floorplan
        //change name from results to else
        let results = parent.sensor_data;
        this.attach_sensors(parent, results, scale)
        console.log(results)


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

        // console.log(parent.crates_with_sensors[crate], crate)
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
        //magic happens here
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

    attach_sensors(parent, results, scale) {
        let main_svg = d3.select('#drawing_svg').append('g').attr('id', 'heatmap');
        //declare circle properties - opacity and radius
        let opac = 1;
        let rad = 4; // radius of sensor icon in METERS (i.e. XYZF before transform)
        for (let sensor in results) {
            try {
                //    console.log(sensor)
                //    console.log(results[sensor])
                //    console.log(results[sensor]['location'])
                let x_value = results[sensor]['location']['x'] * scale
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['location']['y'] * scale
                let floor_id = results[sensor]['location']['f'] * scale
                let sensor_id = results[sensor]['acp_id'];

                main_svg.append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("transform", null)
                    .attr("r", rad)
                    .attr("id", 'hm_' + sensor_id)
                    .style("opacity", parent.sensor_opacity)
                    .style("fill", "pink")
                    .on('mouseover', function (d) {
                        console.log(sensor_id, results[sensor]);
                    })
                //  .attr("transform", parent.master.svg_transform);

            } catch (error) {
                console.log(error)
            }

        }
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
            .attr("x", c_conf.width / 3)
            .attr("width", c_conf.width / 4)
            .attr("height", 2.5)
            .style("fill", 'lime');

        let rounded_val = Math.round(value * 100 + Number.EPSILON) / 100

        parent.jb_tools.add_text(d3.select("#hover_val"), rounded_val, (c_conf.width / 3) + 50, scale_inv(value), "0.65em", "translate(0,0)") // 0 is the offset from the left

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
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.max, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(parent.master.legend_svg, parent.min_max_range.min, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.min) + 25, "0.75em", "translate(0,0)") // 0 is the offset from the left

        parent.jb_tools.add_text(parent.master.legend_svg, document.getElementById('features_list').value, (c_conf.width / 2) - 220, scale_inv(parent.min_max_range.min) - 265, "0.85em", "rotate(-90)") // 0 is the offset from the left

    }

}