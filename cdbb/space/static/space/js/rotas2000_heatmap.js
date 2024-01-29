"use strict"

const MEDIUM_REZ = 5;
const HIGH_REZ = 3;
const LOW_REZ = 8;


var UPDATE_HEATMAP=true;
var UPDATE_SPLASH=true;
//modify to define in read_url()
//const SELECTED_CRATE='GW20-FF';
console.log('URL ID, ', window.location.pathname);

const SELECTED_CRATE=window.location.pathname.split('/')[3];//'corridor-middle-GF';
console.log('URL ID, ', window.location.pathname.split('/')[3]);

let DIST_POW=2.5;
let SUBTRACT_MIDNIGHT=false;

let FULL_DATA={};
let FULL_DATA_OG={};

let ALL_SENSORS=[];
let SENSOR_INDICES={};

let reverse_slider_scaling;
let direct_slider_scaling;


let TIME_BUS={};

class RotasHeatMap {

    // Called to create instance in page :let rt_heatmap = new HeatMap(floor_plan);

    constructor(floor_plan) {

        let parent = this;

        //throughout the class the master is the main visualisation, parent is HeatMap
        this.floor_plan = floor_plan;

        // Instatiante an RTmonitor class
        //this.rt_con = new RTconnect(this);

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
        this.feature = 'co2'; //set temperature as the default for this page

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

//rewrite handle_sensors_metadata becayse otherwise we/re ignoring the timestmap at the url level
//and getting wrong data.

        this.handle_sensors_metadata(this, API_READINGS_INFO);//this disregards the selected date on the url
        //this.handle_sensors_metadata_d3(this);//this disregards the selected date on the url
        //this.show_heatmap(this);

       // console.log('API READINGS', API_READINGS_INFO);
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
        this.color_scheme = d3.scaleSequential(d3.interpolateTurbo); //interpolateViridis//interpolatePlasma//interpolateInferno/RdYlGn

        //make a global c_conf reference from the parent class;
        //this creates a colorbar svg on the right side of the screen
        this.c_conf = this.jb_tools.canvas_conf(90, 240, 15, 8, 15, 32);

        //heatmap opacity
        this.default_opacity = 0.85;
        this.sensor_opacity = this.floor_plan.sensor_opacity;
        //-------MISC STYLING END------//


		this.value_ranges={'temperature':[13,21],'co2':[380,600], 'humidity':[30,55],'vdd':[3500,3700]};
			this.value_ranges_subtr={'temperature':[-1,5],'co2':[-40,100], 'humidity':[30,55],'vdd':[3500,3700]};

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
        //this.connect_rt(this)

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//
        this.setup_controls(this);

		
		get_day_crate();
		//do_rotas();
		
		
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



	//------------------------------------------------------//
	  //connect to rt monitor
        document.getElementById('toggle_rotas_switch').addEventListener('click', () => {
        console.log('doing rotas');
        do_rotas();
        UPDATE_HEATMAP=false;
        UPDATE_SPLASH=true;
        });

          //connect to rt monitor
        document.getElementById('toggle_splash_switch').addEventListener('mouseup', () => {

		UPDATE_HEATMAP=!UPDATE_HEATMAP;
        UPDATE_SPLASH=!UPDATE_SPLASH;
         console.log('toggling splashes', UPDATE_HEATMAP, UPDATE_SPLASH);

        });

	//------------------------------------------------------//

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

		//parent.feature=get_url_param('feature');

		// let queryStr = window.location.search;
		// let urlPar = new URLSearchParams(queryStr);
		// parent.feature= urlPar.get('feature');

        console.log('URL READ', parent.feature,urlParams.get('feature'));
        

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
            let polygon_transform = crate.attributes.transform.value;
            //the last element in the the list of polygon coordinates is an empty string, so we remove it
            polygon_points.pop();

            //with the previous BIM polygon information, make its copy as a polygon clippath
            let crate_polygon =
                clip_def.append("polygon")
                .attr("points", polygon_points)
                .attr("transform", polygon_transform)
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
        let final_radius = 5;//motion_trigger == true ? parent.circle_radius * 10 : parent.circle_radius * 5;
        
		console.log('MOTION ', acp_id, motion_trigger);
        //get the sensor's position
        let position = {
            'x': d3.select('#' + acp_id + "_bim").attr('cx'),
            'y': d3.select('#' + acp_id + "_bim").attr('cy'),
            'transf': d3.select('#' + acp_id + "_bim").attr("transform")
        }

        //draw three expanding circles as a splash
        for (let splash_index = 1; splash_index < 4; ++splash_index) {

            //stroke should be a function of time, so over the course of the splash animation
            //we change it from a thicker stroke to a smaller one, showing how the splash slowly disintegrates

            //calculate the starting stroke for the splash's circle
            let stroke_start = 4.5 / (parent.svg_scale * splash_index); //strokes take into account the svg scale

            //calculate the finishing stroke for the splash's circle
            let stroke_finish = 1.5 / (parent.svg_scale * splash_index); //strokes take into account the svg scale

            //create two separate delays for pairs of circles that create ripples
            let ms_delay = splash_index * 400;
            let ms_delay2 = splash_index * 440;

            //two colors, each opposite end of the colorscheme
            let colorA = motion_trigger == true ? 'white':parent.color_scheme(-Infinity);
            let colorB = motion_trigger == true ? 'black':parent.color_scheme(Infinity);

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
                    .attr('transform', position.transf)
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


    // handle_sensors_metadata_d3(parent){
    	    	// 
    	// const queryString = window.location.search;
    	// const urlParams = new URLSearchParams(queryString);
    	// const date = urlParams.get('date');
    	// const feature = urlParams.get('feature');
// 
		// //let floor_number=determine_floor();
// 
    	// let	url='http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_floor_feature/WGB/'+FLOOR_NUMBER+'/'+feature+'/?metadata=true&date='+date;
// 
		// console.log('QUERY URL', url);
    	// 
    	// if(date){
    		// url+='?date='+String(date)+'/'
    		// console.log('selected date is ',date);
    	// }
    	// 
    	 // //load get_floor_feature url
    	 // d3.json(url, {crossOrigin: "anonymous"})
// 
    	        	// .then(function (received_data) {
   	        	  		// parent.init();
// 
    		        	// //console.log('DATA RECEIVO URL', received_data);
      					// //console.log('DATA RECEIVO API', API_READINGS_INFO);
	   	        	    // parent.handle_sensors_metadata(parent, API_READINGS_INFO);
						// //do_rotas();
// 
// 
   	      // });
// 
   	// }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, results) {

        console.log("handle_sensors_metadata() loaded", results);
        const length = Object.keys(results).length;
        console.log("total entried", length);

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in results['sensors']) {

            //console.log('sensor', sensor, results['sensors'][sensor])
            // Note jsonPath always returns a list of result, or false if path not found.
            //let path_val = jsonPath(d, feature['jsonpath']); //d.payload_cooked.temperature;
            //TODO USE JSONPATH
            try {
                let sensor_type = results['sensors'][sensor]['acp_type_id'];
                console.log('current_sensor: ',sensor);

                parent.sensor_data[sensor] = {
                    'acp_id': sensor,
                    'location': results['sensors'][sensor].acp_location_xyz,
                    'crate_id': results['sensors'][sensor].crate_id,

                    //the problem lies with payload because it's the only one targeting results
                    'payload': results['readings'][sensor].payload_cooked, // change with jsonPath -- charts.js example

                    'features': results['sensor_types'][sensor_type].features,
                    'acp_ts': results['readings'][sensor].acp_ts,
                    'acp_feed_ts': results['readings'][sensor].acp_feed_ts

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
        console.log('crates w sensors', parent.crates_with_sensors);
    }

    //when a new message arrives, we want to update our data structures
    //so that the heatmap is always up to date;
    update_sensor_data(parent, msg) {

        //msg contains acp_id, acp_ts and payload_cooked
        try {
            let acp_id = msg.acp_id;
            let new_acp_ts = msg.acp_ts;
            let new_payload = msg.payload_cooked;

         //   console.log(acp_id, new Date(parseInt(new_acp_ts)*1000).toLocaleTimeString("en-GB"), new_acp_ts);

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
                   // console.log('new', feature, 'is', new_value, '(was ' + old_value + ')')
                }

                parent.sensor_data[acp_id].payload[feature] = new_payload[feature];
            }

            //print out that nothing's changed from the previous packet
            if (!any_updates) {
               // console.log('same readings as last message')
            }
            //make the end of the message more distinct
//            console.log('-----------------------------')

        } catch (error) {
			console.log('ERROR msg probably null', msg, ' has no co2');

            //console.log('failed to update the data struct with payloads', error)
            //console.log('msg received:', msg)
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
    get_cell_value_old(parent, crate, coords) {

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

        //iterate through all sensors in the selected crate
        //and calculate the distance from the sensor to the 
        //selected cell (rect)
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

			//option A, make far away sensors appear REALLY far away
            // if(dist>65){
					// dist=999;
             // }

            //option B, disregard thos sensors altogether

            
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

		//debug limit color thresholding
		//let rect_size=0*parent.rect_size;
		
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
                //sensorB readings has to be higher because it is closer! For this reason, we have to run  a second loop to calculate the inverse.
                sensor_data_points.forEach(sensor_point_alt => {

                let sensor_dist_alt=sensor_point_alt.dist;

               // sensor_dist_alt=sensor_dist_alt<rect_size?rect_size:sensor_dist_alt;
               
                    B += combined_dist /sensor_dist_alt;
                });

                //calculate the inverse coefficient from the distance
                let sensor_distance=sensor_point.dist;
               // sensor_distance=sensor_distance<rect_size?rect_size:sensor_distance;
                
                let A = combined_dist / sensor_distance;
                // console.log('A',A,sensor_distance)

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

        //iterate through all sensors in the selected crate
        //and calculate the distance from the sensor to the 
        //selected cell (rect)
        console.log("crate", crate, parent.crates_with_sensors);
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

			//option A, make far away sensors appear REALLY far away
            // if(dist>65){
					// dist=999;
             // }

            //option B, disregard thos sensors altogether

            
            //push the sensor to the list of sensors used for the calculation of the cell (rect) color value
            sensor_data_points.push({
                'sensor': sensor.acp_id,
                'value': sensor.payload[feature],
                'dist': dist
            });

            //add the distance from the cell to the sensor to the cumulative distance  variable
            //(keeps track of the total distance from the cell to all sensors)
            combined_dist += dist;
        });


	let final_val=0;
	let sense_radius=50;


 	let cumul_A=0;
 	let cumul_B=0;
	  sensor_data_points.forEach(sensor_point => {

			  	// cumul_A+=sensor_point.value/(sensor_point.dist*sensor_point.dist);
				// cumul_B+=1/(sensor_point.dist*sensor_point.dist);

				 cumul_A+=sensor_point.value/Math.pow(sensor_point.dist,DIST_POW);
				 cumul_B+=1/Math.pow(sensor_point.dist,DIST_POW);
				// 
			  	// cumul_A+=sensor_point.value/sensor_point.dist;
				// cumul_B+=1/sensor_point.dist;


	  });

//console.log('hi')
		
		return cumul_A/cumul_B;

    }

    //used when generating the heatmap for the first time (not redrawing)
    show_heatmap_original(parent) {
        console.time('[TOTAL TIME LAPSED ]');

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
        let scale = floor.getCTM().a; //.transform.baseVal.consolidate().matrix.a;
        let x_offset = floor.getCTM().e; //.transform.baseVal.consolidate().matrix.e;
        let y_offset = floor.getCTM().f; //.transform.baseVal.consolidate().matrix.f;

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
        d3.selectAll('polygon').nodes().forEach(element => {

            //check that the crate in question has sensors
            let has_sensors = crates_with_sensors_list.includes(element.id);

			if(element.id==SELECTED_CRATE){
				has_sensors=true;
			}else{has_sensors=false;}
			
            //if a crate has sensors and is not of type building or floor, then we fill it with cells(or mini rects)
            //that will make up the pixels of our heatmap
            if (element.dataset.crate_type != 'building' && element.dataset.crate_type != 'floor' && has_sensors) {

                ///class name for cells follows the standart of CRATE_ID + _rect
                let class_name = element.id + '_rect';

                //get the bounding box for a crate polygon
                let bbox = element.getBBox();

                //acquire all points that make up the polygon
                let polygon_points = element.points;

                //get the coordinates (top left) and size (width, height)
                let pol_h = bbox.height * scale;
                let pol_w = bbox.width * scale;
                let pol_top = bbox.y * scale;
                let pol_left = bbox.x * scale;

                let cell_spacing = -0.1; //spacing inbetween cells

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



rotas_redraw(parent){
	   parent.get_min_max(parent,  parent.feature);
	   //reset the colorbar
	    parent.set_colorbar(parent);
		
	d3.selectAll('.'+SELECTED_CRATE+'_rect').nodes().forEach(rect => {

	let loc_list=JSON.parse("["+rect.dataset.loc+"]");                               

	   let loc = {
	                x: parseFloat(loc_list[0]),
	                y: parseFloat(loc_list[1]),
	                scale: parseFloat(loc_list[2])
	            }

	                    let cell_value = parent.get_cell_value(parent, SELECTED_CRATE, loc).toFixed(2); //round to 2dec places ;
	        		    let color = parent.color_scheme(cell_value);
	        		    
						         d3.select(rect)
									.style("fill", function (d) {
	                                    return color
	             					                   })                 
	           				.attr('data-value', cell_value)
	           				.on("mouseover", function (d) {
	           				console.log('setting color bar value to ', cell_value)
	                    			parent.set_cbar_value(parent, cell_value)
	               						 })
	               			 .on("mouseout", function (d) {
	                   		 d3.select('#hover_val').remove();
	                				})
				
			})
			
                  
     
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
        let rad = 4; //hardcoded value for heatmap circles
        //I found that scaling heatmap circle's radius doesn't work as well as with floor.js

        for (let sensor in results) {
            try {
                //    console.log(sensor)
                //    console.log(results[sensor])
                //    console.log(results[sensor]['location'])
                let x_value = results[sensor]['location']['x'] * scale + svg_offset.x_off;
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['location']['y'] * scale + svg_offset.y_off;
                let floor_id = results[sensor]['location']['f'] * scale
                let sensor_id = results[sensor]['acp_id'];

                main_svg.append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("transform", null)
                    .attr("r", rad)
                    .attr("class", 'sensor_node')
                    .attr("id", sensor_id + "_hm")
                    .attr('data-acp_id', sensor_id)
                    .style("opacity", parent.floor_plan.sensor_opacity)
                    .style("fill", "pink")
                    .style('stroke', 'black')
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
            .style("fill", 'white'); // lime colored rectangle to make it distinctive from the colorbar

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

            if (val != undefined && parent.sensor_data[reading].crate_id==SELECTED_CRATE) {
                value_array.push(val);
            }
        }

        //console.log('value arr', value_array, feature, parent.feature)


if(!SUBTRACT_MIDNIGHT){
    parent.min_max_range = {
                    max: parent.value_ranges[parent.feature][1],//q90(value_array).toFixed(2), //max or the 90th percentile value to reduce outliers
                    min: parent.value_ranges[parent.feature][0],//q05(value_array).toFixed(2), //min or the 10th percentile value to reduce outliers
                    max_abs: Math.max(...value_array).toFixed(2), //absolute max
                    min_abs: Math.min(...value_array).toFixed(2) //absolute min
                };
    
	
}   else{
	            //reset the main variable
        // parent.min_max_range = {
            // max: q90(value_array).toFixed(2), //max or the 90th percentile value to reduce outliers
            // min: q05(value_array).toFixed(2), //min or the 10th percentile value to reduce outliers
            // max_abs: Math.max(...value_array).toFixed(2), //absolute max
            // min_abs: Math.min(...value_array).toFixed(2) //absolute min
        // };
		
//reset the main variable
        parent.min_max_range = {
            max: parent.value_ranges_subtr[parent.feature][1], //max or the 90th percentile value to reduce outliers
            min: parent.value_ranges_subtr[parent.feature][0], //min or the 10th percentile value to reduce outliers
            max_abs: Math.max(...value_array).toFixed(2), //absolute max
            min_abs: Math.min(...value_array).toFixed(2) //absolute min
        };
	
}     
    	
        //for colors, we want the heatmap to have a range of min and max, where min and max are adjusted
        //for 95%/5% percentiles;
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);

        //for the animation delay, we can choose either, since it's less important
        parent.animation_delay.domain([parent.min_max_range.min_abs, parent.min_max_range.max_abs]);

       // console.log('new minmax:', parent.min_max_range, 'feature:', feature);
    }
    //-----------------------------------------------------------------//
    //-------------------END UTILITY FUNCTIONS-------------------------//
    //-----------------------------------------------------------------//


}





function get_day_crate(){

let	url='http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_day_crate/wgb/'+String(SELECTED_CRATE)+'/';


const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const date = urlParams.get('date');

if(date){
	url+='?date='+String(date)+'/'
	console.log('selected date is ',date);
}

	 //local file loading from Django
        d3.json(url, {
            crossOrigin: "anonymous"

        }).then(function (received_data) {
			let all_sensors=[];
			

			console.log(Object.keys(received_data));
	
			for (let j=0;j<Object.keys(received_data).length;j++){
				let sensor= Object.keys(received_data)[j];
				console.log(sensor, received_data[sensor].readings.length);
				if (received_data[sensor].readings.length>10){
					all_sensors.push(sensor)
				}
			}

			console.log(all_sensors);
			FULL_DATA=received_data;

			//make a deep copy of the original
			FULL_DATA_OG = JSON.parse(JSON.stringify(FULL_DATA));
			
			ALL_SENSORS=all_sensors;

			console.log('updating:')
			let start_time=FULL_DATA[ALL_SENSORS[0]].readings[0].acp_ts;
			let readings_len=FULL_DATA[ALL_SENSORS[0]].readings.length-1;
			let end_time=FULL_DATA[ALL_SENSORS[0]].readings[readings_len].acp_ts;
	        initiate_rotas_ui(start_time, end_time);


        });

	
}


function get_day_chrono_crate(){

let	url='http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_day_crate/wgb/'+String(SELECTED_CRATE)+'/';


const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const date = urlParams.get('date');

let chrono_readings={};
 
if(date){
	url+='?date='+String(date)+'/';
	console.log('selected date is ',date);
	}






	 //local file loading from Django
        d3.json(url, {crossOrigin: "anonymous"}).then(

        	function (received_data) {
				let pre_chrono_readings=[];
					
				console.log(Object.keys(received_data));


				//iterate through the list of sensors supplied by the api
				for (let j=0;j<Object.keys(received_data).length;j++){

					//get the sensors acp id
					let sensor= Object.keys(received_data)[j];
					let sensor_readings=received_data[sensor].readings;

					console.log(sensor, sensor_readings.length, pre_chrono_readings.length);

					pre_chrono_readings.push(...sensor_readings);
				}


				//iterate through the list of chrono data points
				for (let k=0;k<pre_chrono_readings.length;k++){

					//convert string acp_ts to int to be used as a dict key
					let ts_key_parsed=parseInt(pre_chrono_readings[k].acp_ts);

				// /	console.log(ts_key_parsed, pre_chrono_readings[k].acp_ts)

					if (typeof(chrono_readings[ts_key_parsed])=='undefined'){

						chrono_readings[ts_key_parsed]=[];
						chrono_readings[ts_key_parsed].push(pre_chrono_readings[k]);
					}
					
					else {chrono_readings[ts_key_parsed].push(pre_chrono_readings[k]);}
				}

				console.log(chrono_readings);


				return chrono_readings;


	        });





	        

}

function do_rotas(){


	let	url='http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_day_crate/wgb/'+String(SELECTED_CRATE)+'/';


	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	const date = urlParams.get('date');

	let chrono_readings={};
	 
	if(date){
		url+='?date='+String(date)+'/';
		console.log('selected date is ',date);
		}



	let myPromise = new Promise(function(myResolve, myReject) {
	  let req = new XMLHttpRequest();

	  let response;
	  req.open('GET',url);
	  req.onload = function() {
	    if (req.status == 200) {
	    response=JSON.parse(req.response);
	    console.log('req response',response, req);
	      myResolve(response);
	    } else {
	      myReject("File not Found");
	    }
	  };
	  req.send();
	});

	myPromise.then(
	  function(value) {

	 let chrono_obj= print_data(value);
	 

	console.log('PROMISE SEQUENCE',chrono_obj);

	let chrono_list=Object.keys(chrono_obj);

	let start=chrono_list[0]
	let finish=chrono_list[chrono_list.length-1];

	TIME_BUS=chrono_obj;

	console.log('SF', start, finish);
	initiate_rotas_ui(start,finish); //modify move slider to take TIME BUS as an argumetn so no global level variable would be needed

	  },
	  
	  function(error) {console.log('NOOOPE', value);}
);


function print_data(received_data) {


				let pre_chrono_readings=[];
					
				console.log(Object.keys(received_data));


				//iterate through the list of sensors supplied by the api
				for (let j=0;j<Object.keys(received_data).length;j++){

					//get the sensors acp id
					let sensor= Object.keys(received_data)[j];

					let sensor_readings=received_data[sensor].readings;
					
					console.log('sensor_readings',sensor_readings);
					console.log(sensor, sensor_readings.length, pre_chrono_readings.length);

					pre_chrono_readings.push(...sensor_readings);
				}


				//iterate through the list of chrono data points
				for (let k=0;k<pre_chrono_readings.length;k++){

					//convert string acp_ts to int to be used as a dict key
					let ts_key_parsed=parseInt(pre_chrono_readings[k].acp_ts);

					//console.log(ts_key_parsed, pre_chrono_readings[k].acp_ts)

					if (typeof(chrono_readings[ts_key_parsed])=='undefined'){

						chrono_readings[ts_key_parsed]=[];
						chrono_readings[ts_key_parsed].push(pre_chrono_readings[k]);
					}
					
					else {chrono_readings[ts_key_parsed].push(pre_chrono_readings[k]);}
				}

			//	console.log(chrono_readings);

				return chrono_readings;

			}

	
}


//given a timestamp, checks if there's any events on the TIME_BUS
//and draws those splashes
function check_for_splash(unix_ts){
	 
	let time_bus_list=TIME_BUS[unix_ts];

	console.log('TIME ',unix_ts );

	if(time_bus_list==undefined){

	//don't show anything for that point in time;
	return;

	 
	}
	else{
		time_bus_list=TIME_BUS[unix_ts];
		
		console.log('DEBUG LIST ',time_bus_list);
	}

	//if the time_bus_list is non empty, visualise it on screen
	for (let i=0; i<time_bus_list.length;i++){

		let time_bus_sensor=time_bus_list[i].acp_id
	
		console.log('INCOMING SPLASH [',(i+1),'/',time_bus_list.length,']', time_bus_sensor, unix_ts);

		let motion_bool=check_payload_motion(time_bus_list[i]);

		if(UPDATE_SPLASH){
			rt_heatmap.draw_splash(rt_heatmap, time_bus_sensor, motion_bool);
		}	
	}

}


//given a timestemp, skips time to the nearest splash event
function roll_to_adjacent(unix_ts, direction){

	//define nearest timestamp, could be past or future adjacent
	let nearest_adjacent;
	
	//get the list of all available timestamps and sort it
	let timestamp_list= Object.keys(TIME_BUS).sort()

	//check the two surroundin timestamps at i-1 and i+1
	//and select which one has the smallest delta	
	//https://stackoverflow.com/questions/8584902/get-the-closest-number-out-of-an-array
	let closest_value = timestamp_list.reduce((prev, curr) => Math.abs(curr - unix_ts) < Math.abs(prev - unix_ts) ? curr : prev);

	//find the nearest timestamp in the future
	if (direction=='forward'){
		//console.log('forward ', 'found:', closest_value,'OG', unix_ts)

		if(closest_value>unix_ts){
			nearest_adjacent= closest_value;
		}
		else{
			//if nearest is less than current
			//console.log('is new less than og?',(closest_value<unix_ts));
			let next_index=timestamp_list.indexOf(closest_value)+1;
			let ts_list_len=timestamp_list.length;

			nearest_adjacent = (next_index <ts_list_len) ? timestamp_list[next_index] :  false;

		}
	}

	//find the nearest timestamp in the past
	if (direction=='backward'){
		//console.log('backward ', 'found:', closest_value,'OG', unix_ts)
		if(closest_value<unix_ts){
			nearest_adjacent= closest_value;
		}
		else{
			//if nearest is less than current
			//console.log('is new less than og?',(closest_value<unix_ts));
			let prev_index=timestamp_list.indexOf(closest_value)-1;
			 nearest_adjacent = (prev_index >= 0) ? timestamp_list[prev_index] :  false;
			
		}
	}


	if(nearest_adjacent!=false){
	
		let time_bus_list=TIME_BUS[nearest_adjacent];

		//if the time_bus_list is non empty, visualise it on screen
		for (let i=0; i<time_bus_list.length;i++){

			let time_bus_sensor=time_bus_list[i].acp_id
		
			console.log('INCOMING SPLASH [',(i+1),'/',time_bus_list.length,']', time_bus_sensor, unix_ts);

			let motion_bool=check_payload_motion(time_bus_list[i]);

			if(UPDATE_SPLASH){
				rt_heatmap.draw_splash(rt_heatmap, time_bus_sensor, motion_bool);
			}

	       	
		}
	}

	return nearest_adjacent;
		
}

function check_payload_motion(message){
	
		//check for motion events
		let payload=message.payload_cooked;
		let motion_event=false;
		if ("motion" in payload){
			if(payload.motion>0){
				motion_event=true;	
			}
		}
		return motion_event;
}

function get_url_param(parameter){
	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	return urlParams.get(parameter);
}

function roll_heatmap(ts_input, sub_mid){

	let time= get_hours(ts_input)
	//console.log('rolling rolling rolling');
	let timing=true;

	const map = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2;

    let param_date=get_url_param('date');
	rt_heatmap.feature=get_url_param('feature');

	let midnight;
	//let now;

	let midnight_date;

	let time_prefab;
	let time_calc;
	let preselected_date;

	//if there's no date specified use the preselected date	
	if(!param_date){

		console.log('date==today')
		//solve this mess because I think what happens is 
		//there is a mismatch between the ranges of now and then
		//and midnight then vs the time specified
		//no preselected date, select now
		preselected_date=Math.floor(Date.now() / 1000)//CHANGE THIS TO NOT NOW BUT DATE
		time_prefab=new Date();
		time_calc=time_prefab.setHours(time[0],time[1],0,0)/1000;
		midnight_date=new Date();
		midnight_date.setHours(0,0,0,0);
		midnight=midnight_date.getTime()/1000;}

		else{

			let selected_date=new Date(param_date);
			//midnight
			midnight=Math.floor(selected_date.valueOf()/1000);

			preselected_date=selected_date.setHours(23,59,0,0)/1000;
			
			time_calc=selected_date.setHours(time[0],time[1],0,0)/1000;

			//	console.log('\nmidnight1',format_time(midnight),midnight, '\nmidnight2',format_time(preselected_date),preselected_date,'\ntime_cal',format_time(time_calc),time_calc);
		}

	if(timing){
		 console.time('[TOTAL RETRIEVAL TIME LAPSED]');
	}

		let ts_analysis=[];

		if(sub_mid){
			console.log('running midnight bias', sub_mid);

			FULL_DATA=midnight_bias(FULL_DATA);
		}
	

		for (let i =0; i<ALL_SENSORS.length;i++){

			let sensor=ALL_SENSORS[i];

			let reading_length=FULL_DATA[sensor].readings.length;

			let adjusted_index=parseInt(map(time_calc, parseInt(midnight), parseInt(preselected_date), 0,reading_length));
			//console.log(time_calc, parseInt(midnight), parseInt(preselected_date), 0,reading_length, '---', adjusted_index);

			//let sliced_arr=FULL_DATA[sensor].readings.slice(adjusted_index-20,adjusted_index+20);
			//console.log('SLICED ARR',sliced_arr);
	        let index_start=0;//adjusted_index-30;
	        let index_finish=reading_length-1;//adjusted_index+30;

			let full_data_copy=FULL_DATA;
			let new_index=recursiveFunction(full_data_copy[sensor].readings,time_calc,index_start,index_finish);
			
			if(new_index==false){
				console.log('BINARY SEARCH FAILED, using ',adjusted_index)
			}
			
			new_index=new_index==false?adjusted_index:new_index;		

			let msg=FULL_DATA[sensor].readings[new_index];

		if(sub_mid){
			let msg_og=FULL_DATA_OG[sensor].readings[new_index];
			console.log('current val ', msg.payload_cooked[rt_heatmap.feature], 'original ', msg_og.payload_cooked[rt_heatmap.feature])
		}
			//sensor step
			//be wary that some sensors have 5x fewer readings than others, notably
			//elsys-co2-0559f2 
			//elsys-co2-0559f3
			//elsys-co2-0559fb 
			SENSOR_INDICES[sensor]=new_index;

			ts_analysis.push(parseInt(msg.acp_ts));

			rt_heatmap.update_sensor_data(rt_heatmap, msg);
	 
      
		}

		// console.log('requested-ts',ts_input);
		 describe_delta_list(ts_analysis, ts_input);
		  // //get min/max for the selected feature
 		 rt_heatmap.get_min_max(rt_heatmap,  rt_heatmap.feature);
        //reset the colorbar
        rt_heatmap.set_colorbar(rt_heatmap);

	    rt_heatmap.rotas_redraw(rt_heatmap);


	if(timing){

		// console.timeEnd('[HEATMAP REDRAW]');
		 	 console.timeEnd('[TOTAL RETRIEVAL TIME LAPSED]');
	}

}

function midnight_bias(sensor_readings){

	//sensor_readings aka FULL_DATA as a an object with sensor acp_ids as keys, with lists as readings following that

	let midnight_list=[];

	Object.keys(sensor_readings).forEach((sensor)=>{

		if(sensor_readings[sensor].readings.length>0){

			let midnight_reading=sensor_readings[sensor].readings[0].payload_cooked[rt_heatmap.feature];

			midnight_list.push(midnight_reading);

		}
				
	});

	let midnight_stats=describe_list(midnight_list,0);

	Object.keys(sensor_readings).forEach((sensor)=>{

		let readings_list=sensor_readings[sensor].readings;
		let readings_len=readings_list.length;
		
		if(readings_len>0){

			let midnight_reading=sensor_readings[sensor].readings[0].payload_cooked[rt_heatmap.feature];
			
			console.log(sensor,'midnight_reading', midnight_reading, midnight_stats);
		
			for(let u =0; u<readings_len;u++){
					let readings_entry=readings_list[u];
					
					readings_entry.payload_cooked[rt_heatmap.feature]=readings_entry.payload_cooked[rt_heatmap.feature]-midnight_reading;

					readings_entry.payload_cooked[rt_heatmap.feature]=readings_entry.payload_cooked[rt_heatmap.feature]+midnight_stats['median'];
			
				}
			// sensor_readings[sensor].readings.forEach((reading, i)=>{
		// 
		// });
	
			
		}

	
				
	});

		return sensor_readings;
}



function describe_delta_list(list, requested){	

	list=list.sort()
//	console.log('LIST', list);
	function std(numbersArr) {
	    // CALCULATE AVERAGE
	    var total = 0;
	    for(var key in numbersArr) 
	       total += numbersArr[key];
	    var meanVal = total / numbersArr.length;
	    // CALCULATE AVERAGE
	  
	    // CALCULATE STANDARD DEVIATION
	    var SDprep = 0;
	    for(var key in numbersArr) 
	       SDprep += Math.pow((parseFloat(numbersArr[key]) - meanVal),2);
	    var SDresult = Math.sqrt(SDprep/(numbersArr.length-1));
	    // CALCULATE STANDARD DEVIATION
	
	    return SDresult;       
	}

	function median(values){
	  if(values.length ===0) throw new Error("No inputs");
	
	  values.sort(function(a,b){
	    return a-b;
	  });
	
	  var half = Math.floor(values.length / 2);
	  
	  if (values.length % 2)
	    return values[half];
	  
	  return (values[half - 1] + values[half]) / 2.0;
	}

	const average = list.reduce((a, b) => a + b, 0) / list.length;

//	console.log('REQUESTED',requested,'MEAN: ', requested-average, 'MEDIAN ',requested- median(list), 'STD ',std(list), 'min/max delta: ', list[list.length-1]-list[0]);

	console.log(
		'\nREQUESTED:',	requested,get_hours(requested).toString(),
		'\nMEAN △:', 	Math.abs(((requested-average)/60).toFixed(1)),'min', 
		'\nMEDIAN △:',	Math.abs(((requested- median(list))/60).toFixed(1)),'min', 
		'\nSTD:',			(std(list)/60).toFixed(1), 'min',
		'\nmin/max △: ', ((list[list.length-1]-list[0])/60).toFixed(1),'min'
		
		);

}

function describe_list(list, rounded){	
	list=list.sort()

//	console.log('LIST', list);
	function std(numbersArr) {
	    // CALCULATE AVERAGE
	    var total = 0;
	    for(var key in numbersArr) 
	       total += numbersArr[key];
	    var meanVal = total / numbersArr.length;
	    // CALCULATE AVERAGE
	  
	    // CALCULATE STANDARD DEVIATION
	    var SDprep = 0;
	    for(var key in numbersArr) 
	       SDprep += Math.pow((parseFloat(numbersArr[key]) - meanVal),2);
	    var SDresult = Math.sqrt(SDprep/(numbersArr.length-1));
	    // CALCULATE STANDARD DEVIATION
	
	    return SDresult;       
	}

	function median(values){
	  if(values.length ===0) throw new Error("No inputs");
	
	  values.sort(function(a,b){
	    return a-b;
	  });
	
	  var half = Math.floor(values.length / 2);
	  
	  if (values.length % 2)
	    return values[half];
	  
	  return (values[half - 1] + values[half]) / 2.0;
	}

	const average = list.reduce((a, b) => a + b, 0) / list.length;

//	console.log('REQUESTED',requested,'MEAN: ', requested-average, 'MEDIAN ',requested- median(list), 'STD ',std(list), 'min/max delta: ', list[list.length-1]-list[0]);

	console.log(
		'\nMEAN :', 	average.toFixed(rounded), 
		'\nMEDIAN :',	median(list).toFixed(rounded), 
		'\nSTD:',		std(list).toFixed(rounded), 
		'\nmin/max △: ',(list[list.length-1]-list[0]).toFixed(rounded)
		
		);

		return {
				'mean':	parseFloat(average.toFixed(rounded)), 
				'median':parseFloat(median(list).toFixed(rounded)), 
				'std':	parseFloat(std(list).toFixed(rounded)), 
				'delta':parseFloat((list[list.length-1]-list[0]).toFixed(rounded))
			}

}

///-----PROBABLY NEED TO RENAME THIS FUNCTION BECAUSE IT IS REPOSNSIBLE FOR Ui
function initiate_rotas_ui(start, end){

	//-------------------------------------------------------------------//
	//							BUTTON DEFINITIONS						 //
	//-------------------------------------------------------------------//

	console.log('START',start, 'END', end);

	//----------define slider inputs----------------//

	let slider = document.getElementById("myRange");
	let output = document.getElementById("show_time");
	let output_ts = document.getElementById("show_unix_ts");
	let output_date = document.getElementById("show_date");


	//output.innerHTML = format_time(slider.value); // Display the default slider value
	let current_value=slider.value;

	//-----voronoi slider inputs-----//
	let slider_voronoi=document.getElementById("voronoi_slider");
	let output_voronoi=document.getElementById("vor_val");
	output_voronoi.innerHTML =DIST_POW;
	//---end voronoi slider inputs---//

	//-------------end slider inputs----------------//


	console.log('selected_time',current_value);

	 document.getElementById('update_heatmap_button').addEventListener('mouseup', () => {
				roll_heatmap(slider.value, false);	
        });

      document.getElementById('update_heatmap_button_midnight').addEventListener('mouseup', () => {
				roll_heatmap(slider.value, true);	
        });

	//----------define control button inputs----------------//

	let button_play=document.getElementById("button_play");
	let button_stop=document.getElementById("button_stop");

	let button_skip_f=document.getElementById("button_skip_forward");
	let button_skip_b=document.getElementById("button_skip_backward");

	let button_forward_1=document.getElementById("button_forward_1");
	let button_forward_10=document.getElementById("button_forward_10");
	let button_forward_60=document.getElementById("button_forward_60");
	let button_forward_300=document.getElementById("button_forward_300");


	let button_backward_1=document.getElementById("button_backward_1");
	let button_backward_10=document.getElementById("button_backward_10");
	let button_backward_60=document.getElementById("button_backward_60");
	let button_backward_300=document.getElementById("button_backward_300");

	//-------------end control button inputs----------------//


	//-------------d3.js housekeeping----------------//

	//remove user interaction with sensors circles 
	let button_del_sensors=document.getElementById("button_del_circle");

	button_del_sensors.onclick = function(){
		d3.selectAll('.sensor_node').attr('pointer-events', 'none');
	};


	//remove user interaction with sensors circles 
	let load_scatterplot=document.getElementById("load_scatterplot");

	load_scatterplot.onclick = function(){
		scatter_plot_init();
	};

	//-------------d3.js housekeeping----------------//


	//--------------------------------------------------------//
	//----------define play/stop button events----------------//
	//--------------------------------------------------------//

	let ticking_timer;

	//sets off the timer function, allowing us to march forward in time
	button_play.onclick = function(){
		//get duration
		let duration=document.getElementById("duration").value==''?60:document.getElementById("duration").value;
		let initial_duration=duration;
		let speed=(document.getElementById("speed").value==''?1:document.getElementById("speed").value);
		let speed_multipler =(1/speed)*1000;



		
		//TODO: fix this mess
		ticking_timer = setInterval(function(){
			console.log('timer ', duration, initial_duration);

		  if(duration <= 0){
		    clearInterval(ticking_timer);
			console.log('timer done')
		  } else {

	  		  if(initial_duration<=60){
		  		document.getElementById('button_forward_1').click();
			  }
			   if((initial_duration>60) && (initial_duration<=300)){
		  	document.getElementById('button_forward_10').click();
			  }
			   if((initial_duration>300) && (initial_duration<=600)){
		  	document.getElementById('button_forward_60').click();
			  }
			  
			  if(initial_duration>600){
		  	document.getElementById('button_forward_300').click();
			  }
			  else{
		  	document.getElementById('button_forward_1').click();
			  }

		  
			//update the ticker box	⬛	is &#11035;⬜ is &#11036;
			document.getElementById('ticker').innerHTML=(duration%2==0)?'&#11036':'&#11035';

		  	console.log('timer ticking ',duration,duration%2==0)

		  }

			  if(initial_duration<=60){
		duration -= 1; 		 
			  }
			   if(initial_duration>60 && initial_duration<=300){
		duration -= 10; 		 
			  }
			   if(initial_duration>300 && initial_duration<=600){
		duration -= 60; 		 
			  }
			  
			  if(initial_duration>600 ){
		duration -= 300; 		 
			  }
			  else{
		duration -= 1; 		 
			  }
			  

		},speed_multipler);
	};

	//stop timer prematurely
	button_stop.onclick = function(){
		console.log('Stopping Timer');
		clearInterval(ticking_timer);
	};


	//button skip forward to closest reading
	button_skip_f.onclick = function(){
		
		let found_next=roll_to_adjacent(parseInt(slider.value), 'forward');
		
		if (found_next){
			let time_delta=Math.abs(found_next - parseInt(slider.value));
			console.log('NEXT READING FOUND AT ', found_next, 't_delta is ', time_delta, 'original ts ', slider.value);				 

			let next_ts=parseInt(slider.value)+time_delta; //Add the time delta
			slider.value=next_ts;
			update_main_plot(next_ts)

			if(UPDATE_HEATMAP){
				roll_heatmap(slider.value, false);	
			}			
			
			output.innerHTML = format_time(slider.value); // Display the default slider value
			output_ts.innerHTML = slider.value;//

		}
		
	}
	//button skip backward to closest reading
	button_skip_b.onclick = function(){
		let found_previous=roll_to_adjacent(parseInt(slider.value), 'backward');
		if (found_previous){
			let time_delta=Math.abs(found_previous - parseInt(slider.value));
			console.log('PREV READING FOUND AT ', found_previous, 't_delta is ', time_delta, 'original ts ', slider.value);				 

			let next_ts=parseInt(slider.value)-time_delta; //subtract the time delta
			slider.value=next_ts;
			update_main_plot(next_ts)
			
			if(UPDATE_HEATMAP){
				roll_heatmap(slider.value, false);	
			}			
			
			output.innerHTML = format_time(slider.value); // Display the default slider value
			output_ts.innerHTML = slider.value;//
		}
				
		
	}
	
	//----------------------------------------------------------//
	//-------define all forward and backward button events------//
	//----------------------------------------------------------//

	function update_main_plot(unix_ts){
	  	if(direct_slider_scaling!=undefined){
			d3.select('#plot_line')
			.attr('x1', function(d){return direct_slider_scaling(unix_ts) })	  		
			.attr('x2', function(d){return direct_slider_scaling(unix_ts) })	  	
	  	}
	}

	function traverse_time(direction, seconds){

			for(let i=0; i<seconds;i++){
				if(direction=='forward'){
					let new_val=parseInt(slider.value)+1//add one second
					slider.value=new_val; //add one second
					 update_main_plot(new_val);
					//console.log('forward', slider.value, i)
				}

				if(direction=='backward'){
						let new_val=parseInt(slider.value)-1;//sub one second
					slider.value=new_val; 
					 update_main_plot(new_val);
					//console.log('backward', slider.value, i)
				}
				
				check_for_splash(slider.value);	

			}

		//just a thought - will change later:
		//only update the heatmap if traversing in large intervals
		// if(seconds>59){
				// roll_heatmap(slider.value, false);
		// }

		if(UPDATE_HEATMAP){
				roll_heatmap(slider.value, false);	
		}			
					

		output.innerHTML = format_time(slider.value); // Display the default slider value
		output_ts.innerHTML = slider.value;//
		
	}

	//---------------forward------------------//

	button_forward_1.onclick = function(){
		traverse_time('forward', 1);
	};

	button_forward_10.onclick = function(){
		traverse_time('forward', 10);
	};


	button_forward_60.onclick = function(){
		traverse_time('forward', 60);
	};

	button_forward_300.onclick = function(){
		traverse_time('forward', 300);
	};

	//---------------backward------------------//

	button_backward_1.onclick = function(){
		traverse_time('backward', 1);
	};


	button_backward_10.onclick = function(){
		traverse_time('backward', 10);
	};

	button_backward_60.onclick = function(){
		traverse_time('backward', 60);
	};


	button_backward_300.onclick = function(){
		traverse_time('backward', 300);
	};


	//----------end define button events----------------//

	//------------------------------------------------------//
	//----------------define slider events------------------//
	//------------------------------------------------------//


	// Update the current slider value (each time you drag the slider handle)
	slider.oninput = function() {
		let unix_timestamp=this.value;
		console.log('slider value is ', this.value);
	  
	 	output.innerHTML =format_time(unix_timestamp);
	  	output_ts.innerHTML = unix_timestamp;

	  	let ts_date = new Date(unix_timestamp * 1000);
	  	output_date.innerHTML=ts_date.toLocaleDateString("en-GB")
	  			
	  	check_for_splash(unix_timestamp);
	  	roll_heatmap(unix_timestamp, false);

	  update_main_plot(unix_timestamp);

	}

	//when moving voronoi slider, redraw the heatmap
	slider_voronoi.oninput = function() {
		DIST_POW=this.value;

		output_voronoi.innerHTML =DIST_POW;
		//roll_update(get_hours(slider.value), SUBTRACT_MIDNIGHT);
	}

	//define time constant for 24 skip
	let start_plus24=parseInt(start)+86400;

	//define slider range values
	document.getElementById("myRange").min=parseInt(start);
	document.getElementById("myRange").max=parseInt(start_plus24);
	document.getElementById("myRange").value=parseInt(end);

	output.innerHTML = format_time(parseInt(end));
	output_ts.innerHTML = 'UNIX_TS';//placeholder text value

}


function recursiveFunction (arr, x, start, end) {
      
    // Base Condition
    if (start > end) return false;
  
    // Find the middle index
    let mid=Math.floor((start + end)/2);

  	let arr_val=parseInt(arr[mid].acp_ts);
  	let time_threshold=180;
    // Compare mid with given key x
//    if (arr[mid]===x) return true;
//	console.log('BUG check',format_time(arr_val),format_time(x), arr_val-x,Math.abs(arr_val-x) )
     //if(nearInt(arr_val, x,30)) return mid;//600seconds is 10mins
    if(Math.abs(arr_val-x)<time_threshold) return mid;//600seconds is 10mins
                   
    // If element at mid is greater than x,
    // search in the left half of mid
    //if(arr[mid] > x)
    if(arr_val>x)
        return recursiveFunction(arr, x, start, mid-1);
    else
 
        // If element at mid is smaller than x,
        // search in the right half of mid
        return recursiveFunction(arr, x, mid+1, end);
}

function nearInt(op, target, range) {
    return op < target + range && op > target - range;
}

function format_time(s) {
  return new Date(s * 1e3).toISOString().slice(-13, -5);
}

function get_hours(UNIX_timestamp){
	  let a = new Date(UNIX_timestamp * 1000);
	  let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	  let year = a.getFullYear();
	  let month = months[a.getMonth()];
	  let date = a.getDate();
	  let hour = a.getHours();
	  let min = a.getMinutes();
	  let sec = a.getSeconds();
	 // var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
	let time=[hour,min];
	  return time;
}

function scatter_plot_init(){

	const base_width=d3.select("#drawing_svg").node().getBoundingClientRect().width;
	// set the dimensions and margins of the graph
	const margin = {top: 10, right: 50, bottom: 50, left: 60},
	    width = base_width - margin.left - margin.right,
	    height = 400 - margin.top - margin.bottom;


	console.log('base width', width)
	// append the svg object to the body of the page
	const svg = d3.select("#my_dataviz")
	  .append("svg")
	    .attr("width", width + margin.left + margin.right)
	    .attr("height", height + margin.top + margin.bottom)
	  .append("g")
	    .attr("transform", `translate(${margin.left},${margin.top})`)

	    // .on('mousemove', (event) => {
	          // var coords = d3.pointer( event );
	          // console.log( coords[0], coords[1] ) // log the mouse x,y position
	        // });

	        
   const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
     const date = urlParams.get('date');

		      

	const URL='http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_crate_chart/wgb/'+CRATE_ID+'/?date='+date.toString();
	const url2='"https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/connectedscatter.csv"';
console.log('query url is ', URL);

	let timeFormat = d3.timeFormat("%H:%M");

	d3.json(URL, 
		function(datezzo){
	//		console.log('datezzo graph', datezzo.readings);
//			return {readings: datezzo.readings }
		   //return { date : d3.timeParse("%Y-%m-%d")(d.date), value : d.value
		    
		  }).then(
		  // Now I can use this dataset:
		  function(data,d,i) {



		  	     svg.append("g")
		      .attr('class', 'bgr')
		      .append('rect')
   		      .attr('id', 'bgr_rect')
		      .attr('y', 0)
		      .attr('x', 0)
		      .attr('height',height)
		      .attr('width',width)
   		      .attr('opacity',0.95)
		      .style('fill', 'white');

		      
		  let readings= data.readings;
			console.log('data graph', data.readings,d,i);

		  
		    // Add X axis --> it is a date format
		    const x = d3.scaleLinear()
		      .domain(d3.extent(readings, function(d){
				return d.acp_ts*1000;})
		      )
		      .range([ 0, width ]);

		      
		    svg.append("g")
		      .attr('class', 'x-ticks')
		      .attr("transform", "translate(0," + height + ")")
		      .call(
		      	d3.axisBottom(x)
		      		.ticks(28)
		          	.tickPadding(5)
      			    .tickFormat(timeFormat)
      			  //  .nice()

		       )
		       .selectAll("text")
		           .attr("transform", "translate(-10,10)rotate(-45)")
		           .style("text-anchor", "end")
		           .style("font-size", 20);
		         //  .style("fill", "#69a3b2")
		     
		          //.tickFormat(timeFormat);

		    // Add Y axis
		    const y1 = d3.scaleLinear()
              .domain([rt_heatmap.value_ranges['co2'][0], rt_heatmap.value_ranges['co2'][1]])
		     // .domain( [8000, 9200])
		      .range([ height, 0 ]);
		      
			const y2 = d3.scaleLinear()
              .domain([rt_heatmap.value_ranges['temperature'][0], rt_heatmap.value_ranges['temperature'][1]])
		     // .domain( [8000, 9200])
		      .range([ height, 0 ]);
		      

		    svg.append("g")
		      .call(d3.axisLeft(y1));

		    svg.append("g")
			      .call(
			      	d3.axisRight(y2)
			      )
			      .attr("transform", "translate("+width+",0)rotate(0)");//.orient("right");

		    // // Add the line
		    // svg.append("path")
		      // .datum(readings)
		      // .attr("fill", "none")
		      // .attr("stroke", "#69b3a2")
		      // .attr("stroke-width", 1.5)
		      // .attr("d", d3.line()
		        // .x(d => x(d.acp_ts*1000))
		        // .y(d => y2(d.payload_cooked['temperature']))
		        // )


		         // // Add the line
		    // svg.append("path")
		      // .datum(readings)
		      // .attr("fill", "none")
		      // .attr("stroke", "#ff9633")
		      // .attr("stroke-width", 1.5)
		      // .attr("d", d3.line()
		        // .x(d => x(d.acp_ts*1000))
		        // .y(d => y1(d.payload_cooked['co2']))
		        // )

		        
   // Add the points
		    svg
		      .append("g")
		      .selectAll("dot")
		      .data(readings)
		      .join("circle")
		        .attr("cx", d => x(d.acp_ts*1000))
		        .attr("cy", d => y1(d.payload_cooked['co2']))
		        .attr("r", 5)
		        .attr("fill", "#ff9633");

		        
		    // Add the points
		    svg
		      .append("g")
		      .selectAll("dot")
		      .data(readings)
		      .join("circle")
		        .attr("cx", d => x(d.acp_ts*1000))
		        .attr("cy", d => y2(d.payload_cooked['temperature']))
		        .attr("r", 5)
		        .attr("fill", "#69b3a2");





    reverse_slider_scaling = d3.scaleLinear()
		      .domain([0,width])
		      .range(d3.extent(readings, function(d){
		      				return d.acp_ts*1000;}));

	 direct_slider_scaling = d3.scaleLinear()
		      .domain(d3.extent(readings, function(d){
		      		      				return d.acp_ts;}))//possibly multply by 1000
		      .range([0,width]);

  // Add the line
		    svg
		      .append("g")
		        svg.append("line")
		        .attr('id', 'plot_line')
		  //    .datum(readings)
				.attr('x1', function (d) {return x(readings[10].acp_ts*1000)})
				.attr('y1', 0)
				.attr('x2',  function (d) {return x(readings[10].acp_ts*1000)})
				.attr('y2', height)
		    //  .attr("fill", "none")
		      	.attr("stroke", "red")
		      	.attr("stroke-width", 3)
		      	.attr("cursor", "move")
		      	      .call(d3.drag()
		      	        .on('start', dragStart)
		      	        .on('drag', dragging)
		      	        .on('end', dragEnd)
		      	      )
		      	  
		      
		      	  
 		  .on('mousemove', (event) => {
	          let coords_local = d3.pointer( event );

	          console.log(event);
	         
	          d3.select(event.target)
	         			.attr("stroke-width", 6)
	          		//	.attr('x1', function (d) { return coords_local[0]+25}) // log the mouse x,y position})
	          		//	.attr('x2', function (d) {return x(readings[10].acp_ts*1000)})      
	        		})

 				.on('mouseout', function (d) {d3.select(this).attr("stroke-width", 3)});





    function dragStart(event,d){
        d3.select(this)
          .style("stroke", "black")  
      }
      
    function dragging(event,d){
        var xCoor = event.x;
        var yCoor = event.y;

        d3.select(this)
          .attr("x1", xCoor)
          .attr("x2", xCoor);
		 let unix_ts=parseInt(reverse_slider_scaling(xCoor)/1000);
          console.log(xCoor, unix_ts, get_hours(unix_ts));

		let output = document.getElementById("show_time");
		let output_ts = document.getElementById("show_unix_ts");
		let output_date = document.getElementById("show_date");
	    let slider = document.getElementById("myRange");

		let ts_date = new Date(unix_ts * 1000);
		output_date.innerHTML=ts_date.toLocaleDateString("en-GB")
	    document.getElementById('myRange').value=unix_ts.toString();
	    console.log('bottom_slider value is', unix_ts)
		output.innerHTML =format_time(unix_ts);
	  	output_ts.innerHTML = unix_ts;
	  	check_for_splash(unix_ts);
	  	roll_heatmap(unix_ts, false);

      }
      
      function dragEnd(event,d){
        d3.select(this)
          .style("stroke", "red")
      }
		        
		})
	

	
	
	
}
