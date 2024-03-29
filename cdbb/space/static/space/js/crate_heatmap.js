"use strict"

const MEDIUM_REZ = 0.4;
const HIGH_REZ = 0.2;
const LOW_REZ = 0.6;

class HeatMap {

    // Called to create instance in page :let rt_heatmap = new HeatMap(floor_plan);

    constructor(floor_plan) {

        let parent = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        this.floor_plan = floor_plan;

        // Instatiante an RTmonitor class
        this.rt_con = new RTconnect(this);

        //a set of useful d3 functions
        this.jb_tools = new VizTools2();

        //--------DATA STRUCTURES----------//
        //sensor data+location required to draw the heatmap
        this.sensor_data = {};

        //sensor data saved per crate
        this.crates_with_sensors = {};

        //declare the min max range of values for temp/co2/humidity - will change during runtime
        this.min_max_range = {};
        //--------DATA STRUCTURES END-------//

        //--------------------------------------//
        //--------LOOKUP THE URL FOR ARGS-------//
        //--------------------------------------//

        //resolution (to be changed by the URL)
        this.rect_size = MEDIUM_REZ;
        this.resolution = 'medium';
        //feature (to be changed by the URL)
        this.feature = 'temperature'; //set temperature as the default for this page

        //read url parameters and reset this.feature and this.resolution if necessary
        this.read_url(this);

        /*
        //declare the promise
        this.promiseResolve, this.promiseReject;

        this.loaded = new Promise(function (resolve, reject) {
            parent.promiseResolve = resolve;
            parent.promiseReject = reject;
        });

        //TODO:delete
        this.loaded.then(function () {
            console.log('promise resolved; data finished loading')
        }, function () {
            console.log('someting went wrong')
        })
        */

        //--------------------------------------//
        //------FETCH THE DATA FOR SENSORS------//
        //--------------------------------------//

        this.handle_sensors_metadata(this, API_READINGS_INFO);
        //parent.get_local_sensors(parent);

    }


    // init() called when page loaded
    init() {

        let parent = this;

        //--------ANIMATION DURATIONS----------//
        //total time to draw transitions when changing the active feature (temperature, humidity etc)
        this.crate_fill_duration = 500;

        //separate animation to see how long the 'raindrop' or 'splash' remains visible
        this.ripple_duration = 3500;

        //the delay for drawing individual items during the animation
        this.animation_delay = d3.scaleLinear().range([2500, 500]);
        //------ANIMATION DURATIONS END--------//


        //--------MISC STYLING----------//

        //declare the splash color
        this.splash_color = 'red';

        //declare the main colorscheme for the heatmap
        //https://observablehq.com/@d3/color-schemes ; set by 'd3.interpolate'+color-scheme
        this.color_scheme = d3.scaleSequential(d3.interpolatePlasma) //interpolateViridis//interpolatePlasma//interpolateInferno

        //make a global c_conf reference from the parent class;
        //this creates a colorbar svg on the right side of the screen
        this.c_conf = this.jb_tools.canvas_conf(90, 240, 15, 8, 15, 32);

        //heatmap opacity
        this.default_opacity = 0.75;
        this.sensor_opacity = this.floor_plan.sensor_opacity;
        //-------MISC STYLING END------//


        //--------RT MONITOR MISC----------//
        //set div id's show status change upon connect
        this.txt_div_id = 'rain_rt';
        this.status_div_id = 'rain_rt_state'
        this.timer_short; //the socket has been unactive for a while -- color yellow
        this.timer_long; //assume the socket connection was lost -- color red
        //-------RT MONITOR MISC END-------//


        //--------HEATMAP/SENSOR SCALING----------//
        //get the contextual scaling for ripples
        this.circle_radius = this.floor_plan.sensor_radius;
        this.svg_scale = this.floor_plan.svg_scale;
        //-----HEATMAP/SENSOR SCALING END---------//


        //-----------------------------------//
        //---generate and show the heatmap---//
        //-----------------------------------//
        this.show_heatmap(this);
        this.floor_plan.jb_tools.tooltips();

        //connect rt_monitor automatically
        this.connect_rt(this)

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//
        this.setup_controls(this);

    }


    //SETS UP BUTTONS ON THE SLIDING MENU ON THE RIGHT
    setup_controls(parent) {

        //connect to rt monitor
        document.getElementById('rain_rt_connect').addEventListener('click', () => {
            parent.disconnect_rt(parent)
        });

        //Set up an event listener to hide the HEATMAP
        document.getElementById('reset').addEventListener('click', () => {
            parent.hide_heatmap(parent);
        });

        //attach an event listener to the list of properties
        document.getElementById('features_list').addEventListener('change', function () {
            parent.feature = this.value;
            parent.update_url('feature', parent.feature)

            //first query then load
            parent.change_feature(parent)
        });

        //attach an event listener to change the heatmap resolution
        document.getElementById('resolution_list').addEventListener('change', function () {
            parent.resolution = this.value;
            parent.update_url('resolution', parent.resolution)
            parent.update_resolution(parent, parent.resolution);
        });
    }

    //UPDATES THE URL WITH THE SELECTED FEATURE/HEATMAP RESOLUTION
    //"param" is either 'feature' or 'resolution', "value" can be e.g. co2(feature) or high(resolution)
    update_url(param, value) {
        //get the url with the search parameters
        let url = new URL(window.location.href);
        let search_params = url.searchParams;

        // new value of "param" is set to "value"
        search_params.set(param, value)

        // change the search property of the main url
        url.search = search_params.toString();

        // the new url string
        let new_url = url.toString();

        // output : .../space/floor_rain/FF/?feature=co2&resolution=high
        console.log(new_url);

        //push the state and update the url
        let newRelativePathQuery = window.location.pathname + '?' + search_params.toString();
        window.history.pushState(null, '', newRelativePathQuery);
    }

    //connects to the rt monitor via websockets
    connect_rt(parent) {
        console.log('connect_rt() called');
        //get a list of all sensors rendered on screen
        parent.sub_list = Object.keys(API_SENSORS_INFO["sensors"]);

        //create an rtmonitor connection, telling which sensors to subscribe to
        parent.rt_con.connect(parent.check_status.bind(parent), parent.sub_list);
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

    //updates the rtmonitor status icon on the page
    check_status(rt_status, msg) {
        let parent = this; //reference to the heatmap self object

        //console.log('returned rt_con state', rt_status)

        switch (rt_status) {
            //RealTime monitor connection successful
            case '1':
                document.getElementById(parent.txt_div_id).innerHTML = 'RTm Connected';
                document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(108, 255, 150)';
                break;

                //Message successfully received
            case '2':                
                //MESSAGE RECEIVED, updates data structures
                try {
                    if (parent.sensor_data[msg.acp_id].crate_id != CRATE_ID){
                        break;
                    }
                    //do animation
                    let msg_data = msg;
                    //console.log('rt_status received', rt_status, msg_data)

                    //send not only acp_id but an entire msg
                    //console.log('updating sensor data structs')
                    parent.update_sensor_data(parent, msg_data);

                    //check if the new message only contains a "motion" trigger event
                    let motion_trigger = true;
                    let cooked = msg_data.payload_cooked; //DEBUG hardcoded reference instead of using metadata

                    //if payload_cooked only has a single key and it is 'motion' or 'occupancy'
                    // (usually paired though) then we now
                    //it's an interrupt triggered motion event
                    if ((Object.keys(cooked).length < 3) && (("motion" in cooked) || ("occupancy" in cooked))) {
                        console.log('motion-only event detected', cooked)
                        motion_trigger = false;
                    }

                    //Draw a splash event on screen
                    parent.draw_splash(parent, msg_data.acp_id, motion_trigger)

                } catch (err) {
                    console.log('something went wrong', err)
                    console.log('msg received:', msg)
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

    //changes the url based on what we'd like to
    //show on the page following the initial load
    read_url(parent) {
        //get the url with the search parameters
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        //create booleans to see if feature/resolution exist
        const feature_exists = urlParams.has('feature');
        const resolution_exists = urlParams.has('resolution');

        //change the feature if available
        if (feature_exists) {
            const feature = urlParams.get('feature')
            parent.feature = feature;
            document.getElementById('features_list').value = parent.feature;
        }

        //change the resolution if available
        if (resolution_exists) {
            const resolution = urlParams.get('resolution')
            parent.resolution = resolution;
            document.getElementById('resolution_list').value = parent.resolution;

            //select the resolution from low, medium and high
            switch (resolution) {
                case 'low':
                    parent.rect_size = LOW_REZ;
                    break;

                case 'medium':
                    parent.rect_size = MEDIUM_REZ;
                    break;

                case 'high':
                    parent.rect_size = HIGH_REZ;
                    break;

                default:
                    parent.rect_size = MEDIUM_REZ;
                    break;
            }
        }

        //if no paramters present, simply update the defaults
        else {
            parent.update_url('feature', parent.feature)
            parent.update_url('resolution', parent.resolution)
        }

    }


    //-----------------------//
    //Generates the heatmap--//
    //-----------------------//
    show_heatmap(parent) {
        //stop drawn floorplan polygons from interacting with the heatmap overlay
        d3.selectAll('polygon').attr('pointer-events', 'none');

        //generate the heatmap grid
        parent.show_heatmap_original(parent)
    }

    //-------------------------------------------------//
    //Reloads the heatmap with a different resolution--//
    //-------------------------------------------------//
    update_resolution(parent, rez_value) {
        //remove current heatmap
        d3.selectAll('#heatmap').remove();
        //remove redrawn sensors
        d3.selectAll('#heatmap_sensors').remove();
        //removethe mask layer
        d3.selectAll('#heatmap_splash_layer').remove();

        //change the resolution
        switch (rez_value) {
            case 'medium':
                parent.rect_size = MEDIUM_REZ;
                break;
            case 'high':
                parent.rect_size = HIGH_REZ;
                break;
            case 'low':
                parent.rect_size = LOW_REZ;
                break;
            default:
                parent.rect_size = MEDIUM_REZ;
                break;
        }

        //first reset the drawn floorplan to it's original location
        parent.floor_plan.manage_zoom.reset(parent.floor_plan);

        //create a new heatmap
        parent.show_heatmap(parent);

        //update tooltips
        parent.floor_plan.jb_tools.tooltips();
    }

    //creates a sublayer of masks so that splashes
    //do not cross crate boundaries
    make_clips(parent) {

        //get the app_overlay layer and append a new sublayer for clippaths and splash animations
        const splash_canvas = d3.select("#app_overlay")
            .append("g")
            .attr('id', 'heatmap_splash_layer')

        //append a defs layer for masks
        const defs = splash_canvas.append("defs")

        //add a mask for every crate;
        //here we iterate ovre all drawn BIM polygons and make
        //a copy for each one as a mask polygon
        d3.selectAll('.crate').select('polygon').nodes().forEach(crate => {

            //append clip paths to the defs layer
            let clip_def = defs.append("clipPath")
                .attr('pointer-events', 'none')
                .attr("id", "clip_" + crate.id);

            //copy current polygon infornation and save it be reused for clip path polygons
            let polygon_points = crate.attributes.points.value.split(' '); //this creates a list of coordinates
            let polygon_transform = parent.floor_plan.svg_transform.transform;
            //the last element in the the list of polygon coordinates is an empty string, so we remove it
            polygon_points.pop();

            //with the previous BIM polygon information, make its copy as a polygon clippath
            let crate_polygon =
                clip_def.append("polygon")
                .attr("points", polygon_points)
                // .attr("transform", polygon_transform)
                .attr('pointer-events', 'none')
                .attr('stroke-width', 0.01)
                .attr("stroke", "black")

            //g references for the layer that we will append drawn circles to
            let clippy = splash_canvas
                .append('g')
                .attr("id", 'clipped_' + crate.id)
                .attr("clip-path", "url(#clip_" + crate.id + ")") //pass the mask reference from above
        })
    }

    //draws splashes when new data arrives and recolors the entire crate based on the data
    //acp_id determine where the splash will radiate from, motion_trigger determines the size of the splash
    draw_splash(parent, acp_id, motion_trigger) {

        //find the crate the acp_id sensor is in
        let crate_id = parent.sensor_data[acp_id].crate_id;

        //the motion trigger argument determines the size of the splash
        //the idea here is that we want to emphasize motion triggered splashes,
        //whereas we declare periodic updates to be less importnat and hence smaller splashes are drawn

        //if !motion_trigger, draw a smaller circle
        let final_radius = motion_trigger == true ? parent.circle_radius * 10 : parent.circle_radius * 5;

        //get the sensor's position
        let position = {
            'x': d3.select('#' + acp_id + "_bim").attr('cx'),
            'y': d3.select('#' + acp_id + "_bim").attr('cy'),
            'transf': parent.floor_plan.svg_transform.transform
        }

        let splash_scale = parent.floor_plan.svg_transform.scale;
        // splash_scale = 1.0
        //draw three expanding circles as a splash
        for (let splash_index = 1; splash_index < 4; ++splash_index) {

            //stroke should be a function of time, so over the course of the splash animation
            //we change it from a thicker stroke to a smaller one, showing how the splash slowly disintegrates
            
            //calculate the starting stroke for the splash's circle
            let stroke_start = 4.5 / (splash_scale * splash_index); //strokes take into account the svg scale

            //calculate the finishing stroke for the splash's circle
            let stroke_finish = 1.5 / (splash_scale * splash_index); //strokes take into account the svg scale

            //create two separate delays for pairs of circles that create ripples
            let ms_delay = splash_index * 400;
            let ms_delay2 = splash_index * 440;

            //two colors, each opposite end of the colorscheme
            let colorA = parent.color_scheme(-Infinity);
            let colorB = parent.color_scheme(Infinity);

            //inline function definition for circles
            let create_circle = function (delay_sample, color_sample) {
                d3.select("#clipped_" + crate_id) //target the mask
                    .append("circle")
                    .attr("pointer-events", "none")
                    .attr("cx", position.x)
                    .attr("cy", position.y)
                    .attr("r", 0) //start as a circle with 0 radius
                    .style("stroke-width", stroke_start)
                    .style("fill", 'none')
                    .style('stroke', color_sample) //defines the colors of the circle for splash animation
                    // .attr('transform', position.transf)
                    .transition() //initiate the transition
                    .delay(delay_sample)
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
            //create circles by passing different delays and colors
            create_circle(ms_delay, colorA)
            create_circle(ms_delay2, colorB)
        }

        //change the crate's heatmap by recoloring the cells in based on the new readings
        parent.update_crate_heatmap(parent, crate_id, acp_id);
    }


    //API requests to get sensors per crate
    //THIS IS DONE WHEN CHANGING FEATURES ON THE LOADED PAGE
    change_feature(parent) {

        //get the system and floor paramters required for the url
        let system = parent.floor_plan.floor_coordinate_system;
        let floor = parent.floor_plan.floor_number;

        //DEBUG create new URL with querystring '?<new feature>&resolution=medium'
        console.log("CHANGE FEATURE NOT IMPLEMENTED");
    }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, results) {

        console.log("handle_sensors_metadata() loaded", results);

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in results['sensors']) {

            //console.log('sensor', sensor, results['sensors'][sensor])
            // Note jsonPath always returns a list of result, or false if path not found.
            //let path_val = jsonPath(d, feature['jsonpath']); //d.payload_cooked.temperature;
            //TODO USE JSONPATH
            try {
                let sensor_type = results['sensors'][sensor]['acp_type_id']
                parent.sensor_data[sensor] = {
                    'acp_id': sensor,
                    'location': results['sensors'][sensor].acp_location_xyz,
                    'crate_id': results['sensors'][sensor].crate_id,
                    'payload': results['readings'][sensor].payload_cooked, // change with jsonPath -- charts.js example
                    'features': results['sensor_types'][sensor_type].features,
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
                    });
                }


            } catch (error) {
                console.log('sensor not found:', sensor, '\n', error)
            }
        }
        console.log('crates w sensors', parent.crates_with_sensors)
    }

    //when a new message arrives, we want to update our data structures
    //so that the heatmap is always up to date;
    update_sensor_data(parent, msg) {

        //msg contains acp_id, acp_ts and payload_cooked
        try {
            let acp_id = msg.acp_id;
            let new_acp_ts = msg.acp_ts;
            let new_payload = msg.payload_cooked;

            console.log("New message from: "+acp_id)

            //variable that controls that any new value in packet
            //is different from old
            let any_updates = false;

            parent.sensor_data[acp_id].acp_ts = new_acp_ts;

            //here we take into account that sensor's payload can have only one or multiple updates to features
            //e.g. the new data packet can only have motion=1, w/out updates for other features, hence we can't
            //just wipe the rest of the data by overwriting the entire payload_cooked property in the data struct

            for (let feature in new_payload) {
                let new_value = new_payload[feature];
                let old_value = parent.sensor_data[acp_id].payload[feature];

                if (new_value != old_value) {
                    any_updates = true;
                    console.log('new', feature, 'is', new_value, '(was ' + old_value + ')')
                }

                parent.sensor_data[acp_id].payload[feature] = new_payload[feature];
            }

            //print out that nothing's changed from the previous packet
            if (!any_updates) {
                console.log('same readings as last message')
            }
            //make the end of the message more distinct
            console.log('-----------------------------')

        } catch (error) {
            console.log('failed to update the data struct with payloads', error)
            console.log('msg received:', msg)
        }

    }

    update_crate_heatmap(parent, crate_id, sensor_id) {

        //TODO: update colorbar if min_max changed

        //select the rectangles associated with a selected crate
        let class_id = crate_id + "_rect";
        let selected_crate = crate_id // rect.dataset.crate; //???TODO:should this be sensor_data.crate_id ??? -- to be changed

        d3.selectAll("." + class_id).nodes().forEach(rect => {

            //acquire their position from the HTML data-loc property
            let raw_loc = rect.dataset.loc.split(',')

            //get rect's location on screen
            let rect_loc = {
                x: parseFloat(raw_loc[0]),
                y: parseFloat(raw_loc[1]),
                scale: parseFloat(raw_loc[2])
            }

            //--------------------------------------------//
            //--Uncomment bellow to fake sensor readings--//
            //--------------------------------------------//
            //TODO:check that this works
            /*
             let temp_val = Math.random() * (3 + 3) - 3;
             let current_val = parent.sensor_data[sensor_id].payload.temperature;
             let new_val = temp_val + current_val;

             if (new_val > 40 || new_val < -10) {
                 new_val = current_val;
             }

            //update the reading with a new rand value
            parent.sensor_data[sensor_id].payload.temperature = new_val;
             */

            //--------------------------------------------//
            //------------End of the subsegment-----------//
            //--------------------------------------------//

            //recalculate the rect value based on the new feature
            let cell_value = parent.get_cell_value(parent, selected_crate, rect_loc);

            //transform the feature value into a color
            let color = parent.color_scheme(cell_value);

            let feature = parent.feature;

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
                .style("fill", function (d) {
                    return color
                })
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
                let cell_value = parent.get_cell_value(parent, selected_crate, rect_loc);

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
                    .duration(parent.crate_fill_duration)
                    .style("fill", function (d) {
                        return color
                    })
                    .style('opacity', parent.default_opacity)
            })
        })
    }
    //----------------------------------------------------------------//
    //----------------------HEATMAP CALCULATIONS----------------------//
    //----------------------------------------------------------------//


    //calculate the color value of a heatmap cell
    //takes in the crate and coordinates of a cell as arguments
    get_cell_value(parent, crate, coords) {

        //select on of the features (co2, temperature, humidity etc)
        //TODO:user URL
        let feature = parent.feature; //document.getElementById('features_list').value;

        //get cell's coordinates and scale
        let rect_loc = coords;
        let scale = coords.scale

        //variable used to calculate cumulative distance from a cell to all sensors around it
        let combined_dist = 0;

        //a list that will contain all crates' sensors and their values
        let sensor_data_points = [];
        //an object with sensor's location embedded in it
        let sensor_loc = {};

        //iterate through all sensors in crates that have sensors
        parent.crates_with_sensors[crate].forEach(sensor => {

            //if the sensor does not have the requested feature (e.g. co2), skip it
            if (sensor.payload[feature] == undefined) {
                return 0
            }

            //get sensor's location
            let x_value = parent.sensor_data[sensor.acp_id]['location']['x'];
            let y_value = -parent.sensor_data[sensor.acp_id]['location']['y'];

            //pass the location to the sensor_loc object and adjust the scale for rendering
            //+add the offset from the svg matrix transformation


            sensor_loc = {
                x: x_value * scale + parent.consolidated_svg.x_off,
                y: y_value * scale + parent.consolidated_svg.y_off
            };

            //get the distance from the sensor_loc to the cell (rect) location
            let dist = parent.jb_tools.dist(sensor_loc, rect_loc)

            //push the sensor to the list of sensors used for the calculation of the cell (rect) color value
            sensor_data_points.push({
                'sensor': sensor.acp_id,
                'value': sensor.payload[feature],
                'dist': dist
            });


            //add the distance from the cell to the sensor to the cumulative distance  variable
            //(keeps track of the total distance from the cell to all sensors)
            combined_dist += dist;
        })

        //declare the variable for the color; i.e. final value calculated by the coefficients
        let final_val = 0;

        //declare the coefficients used in the function to calculate the color value
        let C = 0;
        let D = 0;

        //magic happens here;
        //We iterate through all the sensors in the crate and try to calculate how to weigh
        //their reading values in a spatial context.
        sensor_data_points.forEach(sensor_point => {

            //check that the sensor is not the only sensor in the room
            if (sensor_point.dist != combined_dist) {

                let B = 0;

                //second loop because we're calculating the inverse spread of sensor readings;
                //e.g. sensor A is 95% of the total distance (TD) away from cell (far), whereas sensor B is 5% of the total distance away (close);
                //TD is dist(sensorA, cell_location)+dist(sensorB, cell_location);
                //following from this, we can't calculate that cell_value = 0.95*valueA(from sensorA)+0.05*valueB, because the the coefficient for
                //sensorB readings has to be higher because it is closer! For this reason, we have to run  a second loop to calculate the reverse.
                sensor_data_points.forEach(sensor_point_alt => {
                    B += combined_dist / sensor_point_alt.dist;
                });

                //calculate the inverse coefficient from the distance
                let A = combined_dist / sensor_point.dist;

                //multiply the coefficient with the sensor reading value, multiplying the sensor's reading by its relative distance coefficient
                C = A * (1 / B) * sensor_point.value;

                //add that sensor's calculated input to the total sum value for the cell
                D += C;

            } else {
                //if a crate has a single sensor, then only use that sensor's reading a the only value
                final_val = sensor_point.value;
            }

        })
        //return the final result after making sure the calculation were right (hence 0 if crate had no sensors)
        return D == 0 ? final_val : D;
        //DEBUG (randomised color) myColor(Math.floor(Math.random()*100))
    }


    //used when generating the heatmap for the first time (not redrawing)
    show_heatmap_original(parent) {
        console.time('[TOTAL TIME LAPSED ]');

        document.getElementById("app_overlay").setAttribute("transform", parent.floor_plan.svg_transform.transform)

        //get the most recent minmax value range
        parent.get_min_max(parent, parent.feature);

        //make all polygons white so the underlying color does not interfere with the heatmap
        d3.selectAll('polygon').attr('class', 'g0-9')        

        //target the app_overlay and append a sublayer for the heatmap
        let main_svg = d3.select('#app_overlay').append('g').attr('id', 'heatmap'); //parent.page_floor_svg;

        let h = parent.floor_plan.page_floor_svg.clientHeight;
        let w = parent.floor_plan.page_floor_svg.clientWidth;

        //we check for the invisible floor element since it has necessary svg information required to draw the heatmap
        let floor = document.querySelector("[data-crate_type='floor']");

        //!!!-----------IMPORTANT--------------!!//
        //This is actually an intergral part of how we show the heatamp:
        //at first I barely used it but for some reasong the  lockdown lab's heatmap would get offset
        //on x/y axes, so the consolidate() funciton determines the offset (in most cases it's 0)
        //and draws the heatmap overlayed over the floorplan

        //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
        // Required for older version with multiple transform entries
        // let scale = floor.getCTM().a; //.transform.baseVal.consolidate().matrix.a;
        // let x_offset = floor.getCTM().e; //.transform.baseVal.consolidate().matrix.e;
        // let y_offset = floor.getCTM().f; //.transform.baseVal.consolidate().matrix.f;

        let scale = 1.0;
        let x_offset = 0.0;
        let y_offset = 0.0;

        // let scale = parent.floor_plan.svg_transform.scale;
        // let x_offset = parent.floor_plan.svg_transform.x;
        // let y_offset = parent.floor_plan.svg_transform.y;

        let consolidated_svg = {
            scale: scale,
            x_off: x_offset,
            y_off: y_offset
        }

        parent.consolidated_svg = consolidated_svg;
        //-----------------END-------------------//

        let crates_with_sensors_list = Object.keys(parent.crates_with_sensors);

        let rect_count = 0;

        //iterate through a list of polygons aka rooms and fill them with individual heatmaps
        d3.selectAll('polygon').nodes().filter(function(d) {return (d.id == CRATE_ID)} ).forEach(element => {

            //check that the crate in question has sensors
            
            let has_sensors = crates_with_sensors_list.includes(element.id);
            

            //if a crate has sensors and is not of type building or floor, then we fill it with cells(or mini rects)
            //that will make up the pixels of our heatmap
            if (element.dataset.crate_type != 'building' && element.dataset.crate_type != 'floor' && has_sensors) {

                ///class name for cells follows the standart of CRATE_ID + _rect
                let class_name = element.id + '_rect';

                //get the bounding box for a crate polygon
                // let bbox = element.getBBox();
                let bbox = d3.select('#' + CRATE_ID).node().getBBox();

                //acquire all points that make up the polygon
                let polygon_points = element.points;

                //get the coordinates (top left) and size (width, height)
                let pol_h = bbox.height * scale;
                let pol_w = bbox.width * scale;
                let pol_top = bbox.y * scale;
                let pol_left = bbox.x * scale;

                let cell_spacing = -0.005; //spacing inbetween cells

                //create a parent div for all crate lvl heatmaps
                let crate_div = main_svg.append('g').attr('id', element.id + '_heatmap').attr('class', 'heatmap_crates')
                //let crate_div = d3.select("#heatmap_clipped_" + element.id)

                //iterate throught rows and columns and fill in the selected polygon with rectangles representing heatmap cells
                for (let i = pol_left; i <= pol_left+pol_w+parent.rect_size; i += parent.rect_size) {
                    for (let u = pol_top; u <=  pol_top +pol_h+parent.rect_size; u += parent.rect_size) {

                        //declare the coordinates for a new cell
                        let coords = {
                            'x': i / scale,
                            'y': u / scale,
                            'height': h,
                            'width': w
                        };

                        //determine if the cell is inside the polygon boundaries
                        //if(true){//defaulting to true
                        if (parent.jb_tools.inside(coords, polygon_points)) {

                            rect_count++;

                            let selected_crate = element.id;

                            //get the location data + an offset so that the heatmap is aligned with master_svg
                            let loc = {
                                x: (i - parent.rect_size / 2 + x_offset).toFixed(1), //round (i + x_offset).toFixed(1)
                                y: (u - parent.rect_size / 2 + y_offset).toFixed(1), //round (u + y_offset).toFixed(1)
                                cons_svg: consolidated_svg,
                                scale: scale.toFixed(1) //round
                            }

                            let cell_value = parent.get_cell_value(parent, selected_crate, loc).toFixed(2); //round to 2dec places ;
                            let color = parent.color_scheme(cell_value);

                            //draw the cells (rects) on screen
                            crate_div
                                .append("rect")
                                //.style('pointer-events', 'none')
                                .attr('class', class_name)
                                .attr("x", function (d) {
                                    return loc.x;
                                })
                                .attr("y", function (d) {
                                    return loc.y;
                                })
                                .attr("width", parent.rect_size - cell_spacing)
                                .attr("height", parent.rect_size - cell_spacing)
                                .style('opacity', 0)
                                .attr('stroke', 'none')

                                //metadata attributes
                                .attr('data-crate', selected_crate)
                                .attr('data-loc', [loc.x, loc.y, loc.scale])
                                .attr('data-type', parent.feature)
                                .attr('data-value', cell_value)

                                //mouse interactions
                                .on("mouseover", function (d) {
                                    //on mouseover show th cell's value on the colorbar
                                    parent.set_cbar_value(parent, cell_value)
                                })
                                .on("mouseout", function (d) {
                                    d3.select('#hover_val').remove();
                                })

                                .transition() // <------- TRANSITION STARTS HERE --------
                                .delay(function (d, i) {
                                    let delay = parent.animation_delay(cell_value);
                                    return delay;
                                })
                                .duration(parent.crate_fill_duration)
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

        //redraw the sensors on the newly generated heatmap;
        //mandatory passing the consolidated svg object due to svg offsetting
        parent.attach_sensors(parent, results, consolidated_svg)

        //console.log('results', results)

        //debug only, "parent" now working somehow
        parent.set_colorbar(parent);

        console.timeEnd('[TOTAL TIME LAPSED ]');
        console.log('total cells', rect_count)

        //adding another mask layer on top
        parent.make_clips(parent);
    }

    hide_heatmap(parent) {
        d3.select('#heatmap').remove();
        d3.select('#heatmap_sensors').remove();
        d3.select('#heatmap_splash_layer').remove();
        d3.select('#sensor_request').style('opacity', 1);

        //d3.selectAll('.sensor_node_off').attr('class','sensor_node').style('opacity', 0.65);

        console.log('parent.floor_plan', parent.floor_plan)
        //make sure to pass the master object rather than the "heatmap parent" itself

        //OPTIONAL: show choropleth
        parent.floor_plan.setup_choropleth(parent.floor_plan)
        parent.floor_plan.get_choropleth(parent.floor_plan);
    }

    //----------------------------------------------------------------//
    //-------------------END HEATMAP CALCULATIONS---------------------//
    //----------------------------------------------------------------//

    //display sensor on top of the heatmap
    attach_sensors(parent, results, svg_offset) {
        let scale = svg_offset.scale;
        let main_svg = d3.select('#app_overlay').append('g').attr('id', 'heatmap_sensors');        

        //declare circle properties - opacity and radius
        // radius of sensor icon in METERS (i.e. XYZF before transform)
        let rad = 0.28; //hardcoded value for heatmap circles
        //I found that scaling heatmap circle's radius doesn't work as well as with floor.js

        for (let sensor in results) {
            if (results[sensor]['crate_id'] != CRATE_ID){
                continue
            }
            try {
                //    console.log(sensor)
                //    console.log(results[sensor])
                //    console.log(results[sensor]['location'])
                let x_value = results[sensor]['location']['x'] * scale + svg_offset.x_off;
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['location']['y'] * scale + svg_offset.y_off;                
                let sensor_id = results[sensor]['acp_id'];

                main_svg.append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("transform", null)
                    .attr("r", rad)
                    .attr("class", 'sensor_node')
                    .attr("id", sensor_id + "_hm")
                    .attr('data-acp_id', sensor_id)
                    .style("opacity", 0)
                    .style("fill", "pink")
                    .on('mouseover', function (d) {
                        console.log(sensor_id, results[sensor]);
                    })
                //  .attr("transform", parent.floor_plan.svg_transform);

            } catch (error) {
                console.log(error)
            }

        }
    }

    //-----------------------------------------------------------------//
    //----------------------------COLOR BAR----------------------------//
    //-----------------------------------------------------------------//

    //draws the horizontal line over the colobar bar when hovering over the heatmap
    set_cbar_value(parent, value) {

        //save the value received from the cell (this is the raw value)
        let original_value = parseFloat(value).toFixed(1)

        //create an inverse scale required for to map from the cell value back to the colorbar
        let scale_inv = d3.scaleLinear()
            .domain([parent.min_max_range.min, parent.min_max_range.max])
            .range([parent.c_conf.height + parent.c_conf.bottom, parent.c_conf.bottom]) //TODO adjust for top offset as well

        //get the div for the colorbar/legend
        let target_svg = d3.select("#legend_svg");

        //calculate the colorbar's bar's actual width
        //this will be necessary when drawing another rectangle over the colorbar to illustrate a value in range
        let bar_width = parent.c_conf.width - parent.c_conf.left - parent.c_conf.right;

        //adjust  the input value so we account for 5%/95% distribution
        //(more on this in the get_min_max function)
        if (value > parent.min_max_range.max) {
            value = parent.min_max_range.max
        }
        if (value < parent.min_max_range.min) {
            value = parent.min_max_range.min
        }

        //create a hover_val div that will have the text showing the hovered cell's
        //value, a lime colored rectangle showing its relative position in the range of values
        // and a white background for the text
        target_svg.append('g')
            .attr('id', 'hover_val')
            .append('rect')
            .attr("y", scale_inv(value))
            .attr("x", parent.c_conf.left + parent.c_conf.width / 2)
            .attr("width", bar_width)
            .attr("height", 2.5)
            .style("fill", 'lime'); // lime colored rectangle to make it distinctive from the colorbar

        //add a white background for text
        d3.select('#hover_val').append('g')
            .append('rect')
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("x", 0)
            .attr("y", scale_inv(value) - 6) //offset by 6px so it looks nicer
            .attr("width", 57)
            .attr("height", '1.15em')
            .style('fill', 'white')
            .style('opacity', 0.5);

        //show the hovered cell's value in text form (target element, value to show, position_x, position_y)
        let cell_txt_value = parent.jb_tools.add_text(d3.select("#hover_val"), original_value, parent.c_conf.left - 5, scale_inv(value) + 8.5);
        cell_txt_value
            .attr("font-size", '1.15em') //adjust text size
    }


    //creates a colobar element that displays the range of sensor readings on screen
    set_colorbar(parent) {
        d3.select("#legend_svg").remove();
        d3.select('#sensor_request').style('opacity', 0);

        parent.floor_plan.legend_svg = d3.select('#legend_container')
            .append("svg")
            .attr("width", parent.c_conf.width + parent.c_conf.left + parent.c_conf.right)
            .attr("height", parent.c_conf.height + parent.c_conf.top + parent.c_conf.bottom)
            .attr('id', "legend_svg");

        //set the scale
        let scale = d3.scaleLinear().domain([parent.c_conf.height, 0]).range([parent.min_max_range.min, parent.min_max_range.max]); //abs
        //set the inverse scale
        let scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([parent.c_conf.height, 0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = parent.floor_plan.legend_svg.selectAll(".bars")
            .data(d3.range(0, parent.c_conf.height), function (i) {
                return i;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .attr("y", function (i) {
                return parent.c_conf.bottom + i;
            })
            .attr("x", parent.c_conf.left + parent.c_conf.width / 2)

            .attr("height", 1)
            .attr("width", parent.c_conf.width - parent.c_conf.left - parent.c_conf.right)

            .style("fill", function (i) {
                return parent.color_scheme(scale(i));
            });


        //text showing range on left/right
        //jb_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, dy, TRANSLATE);
        parent.jb_tools.add_text(parent.floor_plan.legend_svg, parent.min_max_range.max, parent.c_conf.left + parent.c_conf.width / 2, 0, "0.75em", "translate(0,0)").attr("font-size", '0.75em') // 0 is the offset from the left
        parent.jb_tools.add_text(parent.floor_plan.legend_svg, parent.min_max_range.min, parent.c_conf.left + parent.c_conf.width / 2, parent.c_conf.height + parent.c_conf.top + parent.c_conf.bottom, "0em", "translate(0,0)").attr("font-size", '0.75em') // 0 is the offset from the left

        //Adds the feature on the right side
        parent.jb_tools.add_text(parent.floor_plan.legend_svg, document.getElementById('features_list').value, -parent.c_conf.height / 2, parent.c_conf.left + parent.c_conf.width, "3.5px", "rotate(-90)") // 0 is the offset from the left

    }

    //-----------------------------------------------------------------//
    //------------------------END COLOR BAR----------------------------//
    //-----------------------------------------------------------------//

    //-----------------------------------------------------------------//
    //--------------------UTILITY FUNCTIONS----------------------------//
    //-----------------------------------------------------------------//

    //calculates value ranges for temp/co2/humidity and other during runtime;
    //recalculations are made whenever a new heatmap is selected
    get_min_max(parent, feature) {

        let value_array = [];

        //iterate through the data based on requested feature and extract min/max values
        for (let reading in parent.sensor_data) {

            //console.log('minmax', reading, parent.sensor_data[reading].payload)
            let val = parent.sensor_data[reading].payload[feature];

            if (val != undefined && parent.sensor_data[reading].crate_id == CRATE_ID) {
                value_array.push(val);
            }
        }

        //console.log('value arr', value_array, feature, parent.feature)

        //reset the main variable
        parent.min_max_range = {
            max: q95(value_array).toFixed(2), //max or the 90th percentile value to reduce outliers
            min: q05(value_array).toFixed(2), //min or the 10th percentile value to reduce outliers
            max_abs: Math.max(...value_array).toFixed(2), //absolute max
            min_abs: Math.min(...value_array).toFixed(2) //absolute min
        };

        //for colors, we want the heatmap to have a range of min and max, where min and max are adjusted
        //for 95%/5% percentiles;
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);

        //for the animation delay, we can choose either, since it's less important
        parent.animation_delay.domain([parent.min_max_range.min_abs, parent.min_max_range.max_abs]);

        console.log('new minmax:', parent.min_max_range, 'feature:', feature);
    }
    //-----------------------------------------------------------------//
    //-------------------END UTILITY FUNCTIONS-------------------------//
    //-----------------------------------------------------------------//

    //-----------------------------------------------------------------//
    //------------------------FAKE DEPLOYMENT--------------------------//
    //-----------------------------------------------------------------//


    //callback to update sensors (for faked sensor data)
    update_callback(parent, acp_id, walk) {
        parent.draw_splash(parent, acp_id, true)
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    fake_splashes(parent) {
        console.log(parent.sensor_data)
        for (let sensor in parent.sensor_data) {
            console.log('incoming update ', sensor)
            let wildcard = false //Math.random() < 0.5;
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(8000, 8000 * 10), parent, sensor, wildcard);
        }
    }

    //show fake path on LL
    fake_path(parent) {
        let sens_list;
        switch (CRATE_ID) {
            case 'GF':
                sens_list = [
                    "elsys-ers-04f006",
                    "elsys-ers-04f007",
                    "elsys-snd-04bb60",
                    "elsys-ers-04f005",
                    "elsys-co2-0558bb",
                    "elsys-co2-0558b2",
                    "elsys-co2-0558b5",
                    "elsys-co2-0559f5",
                    "elsys-co2-0559f4",
                    "elsys-co2-0559f7",
                ]
                break;
            case 'FF':
                sens_list = [
                    "elsys-ems-050368",
                    "elsys-co2-055872",
                    "elsys-eye-04d243",
                    "elsys-eye-04d241",
                    "elsys-eye-04d23c",
                    "elsys-eye-04d245",
                    "elsys-co2-0559fa",
                    "elsys-eye-04d23e",
                    "elsys-co2-05586f"
                ];
                break;
            case 'll_0':
                sens_list = [
                    "elsys-co2-0520ba",
                    "elsys-ems-0503e0",
                    "elsys-eye-044504",
                    "elsys-co2-0520bb",
                    "elsys-co2-0520bc",
                    "elsys-co2-0520bd",
                    "elsys-co2-0520be",
                    "elsys-co2-0520bf",
                    "elsys-co2-0520c0",
                    "elsys-co2-0520c1",
                    "elsys-co2-0520c2",
                    "elsys-co2-0520c3"
                ];
                break;
        }



        let counter = 1;
        for (let i = 0; i < sens_list.length; i++) {
            let sensor = sens_list[i];
            console.log('incoming update ', sensor)
            window.setTimeout(parent.update_callback, counter * 1000, parent, sensor, false);
            counter++;
        }
    }

    // Alternative to get_readings() using local file for sensors API response
    get_local_sensors(parent) {

        console.log('loading local data')

        //we have fake data only for wgb and vlab
        let selection = CRATE_ID == 'FF' ? 'WGB' : 'VLAB'; //for now leaving the Lockdown Lab away from this

        //local file loading from Django
        d3.json(window.location.origin + "/static_web/js/" + selection + "_JSON.json", {
            crossOrigin: "anonymous"

        }).then(function (received_data) {
            console.log('heatmap received', received_data)
            parent.handle_sensors_metadata(parent, received_data)

            //-----------------------------------//
            //---generate and show the heatmap---//
            //-----------------------------------//
            parent.show_heatmap(parent);
        });
    }

    //-----------------------------------------------------------------//
    //---------------------END FAKE DEPLOYMENT-------------------------//
    //-----------------------------------------------------------------//

}
