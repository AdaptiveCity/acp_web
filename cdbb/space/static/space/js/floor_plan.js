"use strict"

class FloorPlan {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.jb_tools = new VizTools2();

        this.svg_scale;

        // Transform parameters to scale SVG to screen
        this.svg_transform = ""; // updated by set_svg_transform()
        this.next_color = 0;
        this.sensor_readings = {}; //sensor reading data
        this.sensors_in_crates = {};

        this.display_crate_ids = true; // optional
    }

    // init() called when page loaded
    init() {

        if (typeof CRATE_ID == "undefined") {
            let message_el = document.getElementById("message");
            message.innerText = "No in-building location available for this sensor.";
            return;
        }

        console.log("Loading Floorspace for " + CRATE_ID);

        let parent = this;

        // Page template DOM elements we'll update
        this.page_draw_div = document.getElementById("main_drawing_div");
        this.page_floor_svg = document.getElementById("drawing_svg"); // drawing SVG element
        console.log("page_floor_svg", this.page_floor_svg);
        this.page_coords = document.getElementById("drawing_coords");

        // debug for page x,y nit
        this.page_floor_svg.addEventListener('mousemove', function (e) {
            parent.page_coords.innerHTML = e.clientX + "," + e.clientY;
        });

        // object to store BIM data for current floor when returned by BIM api
        this.floor_bim_object = null;

        //------------------------------------//
        //---------CHOROPLETH STUFF-----------//
        //------------------------------------//

        //this.setup_choropleth(parent)

        //------------------------------------//
        //---------CHOROPLETH END--------------//
        //------------------------------------//

        //-------------------------------------------//
        //----------Other global variables-----------//
        //-------------------------------------------//

        //----set parametrs for drawn sensors on the floorplan----//
        this.sensor_opacity = 0.4;
        // radius is calculated wrt scale so we have consistent sensor radius across all spacefloors
        this.radius_scaling = 1.75; // a parameters that helps calculates the sensor radius in response to svg scale
        //calculated in handle_sensors_metadata()
        this.sensor_radius;
        this.sensor_color = "orange"; //cambs yellow
        //--------------------------------------------------------//

        this.previous_circle_radius = 0; // set on mouse over, used to remember radius for reset on mouse out.
        this.defaultScale = 1; /* default scale of map - fits nicely on standard screen */


        /*
        this.promiseResolve, this.promiseReject;

        this.loaded = new Promise(function (resolve, reject) {
            parent.promiseResolve = resolve;
            parent.promiseReject = reject;
        });
        */

        // Do an http request to the SPACE api, and call handle_building_space_data() on arrival
        this.handle_floor_crate(parent, API_BIM_INFO[CRATE_ID]);

        this.handle_space_info(parent, API_SPACE_INFO);

        this.handle_sensors_metadata(parent, API_SENSORS_INFO);

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//
        this.setup_buttons(parent);

        /*
        parent.loaded.then(function () {
            console.log('promise resolved; floor data finished loading')
        }, function () {
            console.log('someting went wrong')
        })
        */
    }


    //changes the url based on what we'd like to
    //show on the page following the initial load
    manage_url() {

    }

    //event listeners for buttons
    setup_buttons(parent) {
        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//

        try {
            //Set up event listener to RESET FLOORPLAN/HEATMAP
            document.getElementById('reset_zoom').addEventListener('click', () => {
                parent.manage_zoom.reset(parent);
            })

            //Set up slider to change sensor opacity
            let slider = document.getElementById("sensor_opacity");
            slider.value = parent.sensor_opacity * 100;

            // Update the current slider value (each time you drag the slider handle)
            slider.oninput = function () {
                let opacity_value = slider.value / 100;
                parent.change_sensor_opacity(parent, opacity_value);
            }
        } catch (error) {

        }
        //--------------------------------------//
        //----------END EVENT LISTENERS---------//
        //--------------------------------------//
    }

    // Will be called with a crate object when that is returned by BIM api
    handle_floor_crate(parent, crate) {

        console.log("handle_floor_crate got", crate);

        //globals
        parent.floor_bim_object = crate;

        //check if we're in floorspace template or not
        parent.floorspace = ((crate.crate_type == 'floor') || (crate.crate_type == 'building')) ? false : true;

        //show BIM metadata on the side (if available)
        if (parent.floorspace) {
            parent.show_bim_metadata(parent, crate);
        }
    }

    handle_space_info(parent, space_info) {
        console.log("handle_space_info() loaded:", space_info);
        let scale = 8.3; //DEBUG

        let xmlStr = atob(space_info["svg_encoded"]); // decode the SVG string

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr, "application/xml");

        // Parent of the SVG polygons is <g id="bim_request"...>
        let bim_request = xml.getElementById('bim_request');

        // Remove the "floor" or "building" crates from the SVG
        let floors = xml.querySelectorAll('polygon[data-crate_type=floor]');
        floors.forEach(function (el) {
            console.log("moving floor polygon to beginning: " + el.id);
            //el.remove();
            //we still needto prepend the floors svg since it is required to determine heatmap's boundary space
            bim_request.prepend(el);
            d3.select(el).style('fill', 'none');
        });

        let buildings = xml.querySelectorAll('polygon[data-crate_type=building]');
        buildings.forEach(function (el) {
            console.log("moving building polygon to beginning: " + el.id);
            el.remove();
            //bim_request.prepend(el);
        });

        console.log('appending to page_floor', parent.page_floor_svg, xml.querySelector('#bim_request'))

        parent.page_floor_svg.appendChild(xml.querySelector('#bim_request'));

        let polygons = parent.page_floor_svg.querySelectorAll("polygon");

        console.log("handle_floor_svg", polygons.length, "polygons");

        //TODO CHECK how and why this does it
        parent.set_svg_transform(parent, polygons);

        //attach polygon styling
        d3.selectAll("polygon")
            .style("stroke-width", 0.5 / scale)
            .attr("stroke", "black")
            .attr("transform", parent.svg_transform);

        //assign fill colors
        d3.select(parent.page_floor_svg).selectAll("polygon")
            .attr("class", function (d) {
                return 'inactive'
            })
            .append("title").text(function (d) {
                return this.parentNode.id;
            });

        //set mouse events
        d3.select(parent.page_floor_svg).selectAll("polygon")
            .on("mouseover", function (d) {
                d3.select(this).attr("class", "hover");
            })
            .on("mouseout", function (d) {
                d3.select(this).attr("class", function (d) {
                    return 'inactive'
                });
            })
            .on('click', function (d) {
                // FLOORSPACE_LINK set in template with "crate_id" string placeholder
                window.location = FLOORSPACE_LINK.replace("crate_id", this.id);
                console.log('CLICKED ON FLOOR_PLAN', d3.select(this))
            });


        if (parent.floorspace) {
            let rooms = document.querySelectorAll('polygon[data-crate_type=room]');
            let svg_el = document.querySelector("#bim_request");
            rooms.forEach(function (room) {
                let svgNS = "http://www.w3.org/2000/svg"; // sigh... thank you 1999
                let box = room.getBBox();
                let box_offset = room.getCTM(); //get consolidated matrix for offset
                let x = (box.x + box.width / 4) * parent.svg_scale + box_offset.e;
                let y = (box.y + box.height / 2) * parent.svg_scale + box_offset.f;
                //console.log('box x y scale', box, x, y, parent.svg_scale, parent.svg_x, parent.svg_y)
                let text = document.createElementNS(svgNS, "text");
                text.setAttribute('x', x);
                text.setAttribute('y', y);
                //set the font
                //either 6 or the scale divided by two, our buildings have different sizes, so shoudl the fonts
                text.setAttribute('font-size', Math.max(4.5, parent.svg_scale / 2));
                text.textContent = room.id;
                svg_el.appendChild(text);
            });
        }

        //add a sublayer for future apps
        d3.select('#drawing_svg').append('g').attr('id', "app_overlay")

        //declare zooming/panning function
        parent.manage_zoom(parent);
    }

    //changes sensor opacity
    change_sensor_opacity(parent, new_opacity) {
        //set new opacity
        parent.sensor_opacity = new_opacity;
        d3.selectAll('.sensor_node').style('opacity', parent.sensor_opacity);
    }

    //allows to scroll into the floorplan/heatmap
    manage_zoom(parent) {

        //if we're in  floorspace page, we need to zoom in on a crate
        if (parent.floorspace) {
            parent.setup_floorspace(parent);
        }

        //setup zooming parameters
        const zoom = d3.zoom()
            .extent([
                [-1, -1],
                [1, 1]
            ])
            .scaleExtent([-0.5, 10])
            .on("zoom", zoomed);

        //bind the zoom variable to the svg canvas
        d3.select('#drawing_svg').call(zoom);

        //zooming/panning for the drawn polygons/rects/sensors
        //TODO; add programmatic zoom for floorspace pages + disable mouse interaction
        function zoomed({
            transform
        }) {
            d3.select('#bim_request').attr("transform", transform);
            d3.select('#app_overlay').attr("transform", transform);
        }

        //resets the panned/zoomed svg to the initial transformation
        function reset() {
            d3.select('#drawing_svg').call(
                zoom.transform,
                d3.zoomIdentity,
            );
        }

        //enable resetting from an outside scope
        parent.manage_zoom.reset = reset;

    }

    //special 'onload' zooming function to zoom in on a preloaded CRATE_ID
    setup_floorspace(parent) {
        //make all polygons white...
        d3.selectAll('polygon').style('fill', '#ffffff')
            .on("mouseover", function (d) {
                //light orange
                d3.select(this).style("fill", "rgb(241, 190, 72)");
            })
            .on("mouseout", function (d) {
                if (this.id != CRATE_ID) {
                    //return to white
                    d3.select(this).style("fill", '#ffffff');
                } else {
                    //after hovering on CRATE ID crate, return it to normal
                    d3.select("#" + CRATE_ID).style('fill', '#e0ffe0'); //light green;
                }
            })

        //and highlight the one in question
        d3.select("#" + CRATE_ID).style("stroke", "#448844").attr("stroke-width", '0.5px').style('fill', '#3CB371');

        function floorspace_zoom() {

            //get the room bounding box
            let bbox_room = d3.select('#' + CRATE_ID).node().getBBox();

            //get the foor bounding box
            let bbox_floor = document.querySelectorAll('polygon[data-crate_type=floor]')[0].getBBox();

            //get the consolidated matrix for making the right offset (for more check the link below or in the heatmap class)
            //https://stackoverflow.com/questions/19154631/how-to-get-coordinates-of-an-svg-element
            let bbox_floor_offset = document.querySelectorAll('polygon[data-crate_type=floor]')[0].getCTM(); //required for lockdown laband potentially others

            // scale_new is the max number of times bounding box will fit into container, capped at 3 times
            let scale_new = Math.min(bbox_floor.width / bbox_room.width, bbox_floor.height / bbox_room.height, 3);

            //calculate the offset and combine it with the consolidated matrix data
            let tx = -bbox_room.x + (bbox_floor.width - bbox_room.width * scale_new) / (2 * scale_new);
            let ty = -bbox_room.y + (bbox_floor.height - bbox_room.height * scale_new) / (2 * scale_new);

            let translate_x = tx * parent.svg_scale - bbox_floor_offset.e;
            let translate_y = ty * parent.svg_scale - bbox_floor_offset.f;

            //highlight the selected crate
            d3.select('#bim_request').transition()
                .duration(750)
                .attr('transform', 'scale(' + scale_new + ')translate(' + translate_x + ',' + translate_y + ')')
                .on('end', function () {
                    d3.select("#" + CRATE_ID).transition()
                        .duration(750)
                        .style("stroke", "#448844")
                        .attr("stroke-width", '2px')
                        .style('fill', '#e0ffe0'); //light green
                })

        }
        //zoom in on load
        d3.select('#bim_request').call(floorspace_zoom);
    }

    // Append each floor to page SVG but keep invisible for now
    // After appending the floor SVG's, we will calculate the scale & xy transform
    set_svg_transform(parent, polygons) {
        let min_x = 99999;
        let max_x = -99999;
        let min_y = 99999;
        let max_y = -99999;

        // Return { x,y,cx,cy,w,h } for an html DOM element (for us often SVG)
        function get_box(element) {
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

        polygons.forEach(function (polygon) {
            // Get bounding box of floor polygon
            let box = get_box(polygon);
            // Update max width, height found so far
            if (box.x < min_x) min_x = box.x;
            if (box.x + box.w > max_x) max_x = box.x + box.w;
            if (box.y < min_y) min_y = box.y;
            if (box.y + box.h > max_y) max_y = box.y + box.h;
            // console.log("box", box);
        });

        // calculate appropriate scale for svg
        let w = parent.page_floor_svg.clientWidth;
        let h = parent.page_floor_svg.clientHeight;

        let x_scale = w / (max_x - min_x);
        let y_scale = h / (max_y - min_y);
        // Set the svg scale to fit either x or y
        let svg_scale = x_scale < y_scale ? x_scale : y_scale;
        parent.svg_scale = svg_scale;

        // x offset
        let svg_x = -min_x * svg_scale;
        let svg_y = -min_y * svg_scale;

        parent.svg_transform = "translate(" + svg_x + "," + svg_y + ") " +
            "scale(" + svg_scale + ")";

        return {
            'x': svg_x,
            'y': svg_y,
            'scale': svg_scale
        }
    }

    // Returns a "list object" (i.e. dictionary on acp_id) of sensors on
    // given floor#/coordinate system
    //   { "sensors": { "rad-ath-0099" : { <sensor metadata> }, ... }}
    handle_sensors_metadata(parent, sensors_info) {
        let recieved_sensor_metadata = sensors_info["sensors"]
        console.log("handle_sensors_metadata() loaded", recieved_sensor_metadata);

        //save the the received data as a global
        parent.sensor_metadata = recieved_sensor_metadata;

        //show sensor metadata on the side (if available)
        if (parent.floorspace) {
            parent.show_sensor_metadata(parent);
        }

        /*
        //change the global data_loaded
        parent.promiseResolve()
        */

        //draw sensors over the floorplan
        parent.attach_sensors(parent);

        //activate tooltips on hover
        parent.jb_tools.tooltips();

        //fill polygons based on # of sensors
        //parent.get_choropleth(parent);
    }

    //displays BIM metadata on the side, when loaded a floorspace page
    show_bim_metadata(parent, crate) {
        var bim_div = document.getElementById('bim_content');
        // We only display BIM metadata *if* there is a div called 'bim_div' on the page
        if (!bim_div) {
            return;
        }

        let floorspace_bim_txt = JSON.stringify(crate, null, 2);
        bim_div.innerHTML = "<pre>" + floorspace_bim_txt + "</pre>";
    }

    //displays sensor metadata on the side, when loaded a floorspace page
    show_sensor_metadata(parent) {
        var sensor_div = document.getElementById('sensor_content')
        // We only display sensor metadata *if* there is a div called 'sensor_div' on the page
        if (!sensor_div) {
            return;
        }

        let sensors = parent.sensor_metadata;
        let sensor_list = {};

        //trycatch in case some sensors don't have crate ids...
        try {
             //iterate through all sensors and only get crate-relevant ones
        for (let acp_id in sensors) {
            if (sensors[acp_id].crate_id == CRATE_ID) {
                sensor_list[acp_id] = sensors[acp_id]
            }
        }

        } catch (error) {
            console.log('error, no crate detected', error)
        }

        let txt = JSON.stringify(sensor_list, null, 2);

        if (sensors == {}) {
            txt = 'no sensors are present in this crate';
        }

        // Display the json sensor metadata on the page in #SENSOR_container
        sensor_div.innerHTML = "<pre>" + txt + "</pre>";
    }

    //draw sensors on the floorplan
    attach_sensors(parent) {

        let recieved_sensor_metadata = parent.sensor_metadata;
        //declare circle properties - radius
        //calculate the sensor radius based on the svg scale; use the log to 'normalise' different scale values;
        parent.sensor_radius = parent.radius_scaling / Math.log(parent.svg_scale)

        let stroke_width = 1 / parent.svg_scale;

        //let rad = ; // radius of sensor icon in METERS (i.e. XYZF before transform)

        //create a div to have all of the sensor circles
        let sensor_div = d3.select("#bim_request").append('g').attr('id', 'sensor_request');

        //iterate through results to extract data required to show sensors on the floorplan
        for (let sensor in recieved_sensor_metadata) {

            let acp_id = recieved_sensor_metadata[sensor]['acp_id'];

            // Skip sensors that don't have xyz coords
            //DEBUG we *could* put them in some default position relative to crate
            if (!recieved_sensor_metadata[acp_id].hasOwnProperty('acp_location_xyz')) {
                console.log('skipping missing acp_location_xyz', acp_id);
                continue;
            }
            try {
                let x_value = recieved_sensor_metadata[acp_id]['acp_location_xyz']['x']
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -recieved_sensor_metadata[acp_id]['acp_location_xyz']['y']
                let floor_id = recieved_sensor_metadata[acp_id]['acp_location_xyz']['f']

                let fill;

                //add data_management functionality
                if ((typeof ACP_ID !== 'undefined') && (acp_id == ACP_ID)) {
                    fill = "#ff0000"; //highlight the sensor in question
                } else {
                    fill = parent.sensor_color;
                }

                //draw sensors on screen
                d3.select('#sensor_request')
                    .append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("r", parent.sensor_radius)
                    .attr("id", acp_id + "_bim")
                    .attr("data-acp_id", acp_id)
                    .attr("class", 'sensor_node')
                    .style("opacity", parent.sensor_opacity)
                    .attr('stroke-width', stroke_width)
                    .style('stroke', 'black')
                    .style("fill", fill)
                    .attr("transform", parent.svg_transform);

            } catch (error) {
                console.log(error)
            }

        }
    }

    //--------------------------------------------------//
    //----------------choropleth definition----------------//
    //--------------------------------------------------//

    //temporary solution to create a heatmap
    obtain_sensors_in_crates(parent) {
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
            crates[i].sensors = parent.get_count_for_crate(parent, sensors, crate);
        }
        return crates;
    }

    //looks at a crate and returns the number of sensors in it
    get_count_for_crate(parent, sensors, crate_id) {

        let count = 0;
        //iterate over the sensor (circles) array
        for (let i = 0; i < sensors.length; i++) {

            let sensor = sensors[i];
            //acquire x/y positions for a sensor
            let point = [sensor.cx.baseVal.value, sensor.cy.baseVal.value];
            //if sensor is within a crate
            if (parent.point_in_crate(crate_id, point)) {
                count++;
            }

        }
        return count;
    }

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

    setup_choropleth(parent) {
        //Determines choropleth's color scheme
        parent.hue = "q"; /* b=blue, g=green, r=red colours - from ColorBrewer */

        //Breaks the data values into 9 ranges, as css has nine hard color categories
        parent.cat_lim = 9;

        //determines how to color in polygon based on X property (e.g. # sensors)
        parent.quantize =
            d3.scaleQuantize()
            .domain([0, parent.cat_lim])
            //TODO change the range that it matches the range of max sensors in a crate
            .range(d3.range(parent.cat_lim).map(function (i) {
                return parent.hue + i + "-" + parent.cat_lim;
            }));

        //Uses in conjunction with quantize above -> enter crate_id and get associated
        //values with it (e.g. # sensors)
        parent.rateById = new Map(); //d3 v6 standard

        parent.set_legend(parent);
    }

    //color polygons based on the number of sensors in them
    get_choropleth(parent) {

        //make drawn floorplan polygons interactive
        d3.select(parent.page_floor_svg).selectAll('polygon').attr('pointer-events', 'all');

        parent.sensors_in_crates = parent.obtain_sensors_in_crates(parent);

        //map crates with sensors so that rateById.get(CRATE) returns #sensors
        d3.map(parent.sensors_in_crates, function (d, i) {
            parent.rateById.set(d.crate_id, d.sensors)
        });

        //quantize polygons again according to sensors in them
        d3.select(parent.page_floor_svg).selectAll("polygon")
            .attr("class", function (d) {
                return parent.quantize_class(parent, parent.quantize(parent.rateById.get(this.id)));
            })

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
                d3.select(this).attr("class", "hover");
            })
            .on("mouseout", function (d) {
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

    }

    //quantizes colors so we have discrete rather continouos values
    //use for the legend+coloring polygons based on the sensors in them
    quantize_class(parent, polygon_id) {
        var quantized_class = polygon_id
        if (quantized_class == undefined) {
            return parent.quantize(0)
        } else {
            return polygon_id;
        }
    }

    //--------------LEGEND definition---------------//
    set_legend(parent) {

        d3.select("#legend_svg").remove();

        //Defines legend container size, appends it
        parent.legend_svg = d3.select("#legend_container")
            .append("svg")
            .attr("id", "legend_svg")
            .style("width", 100)
            .style("height", 225);

        /* Thanks to http://stackoverflow.com/users/3128209/ameliabr for tips on creating a quantized legend */
        parent.legend = parent.legend_svg.selectAll('g.legendEntry')
            .data(parent.quantize.range())
            .enter()
            .append('g').attr('class', 'legendEntry');

        //Adds small rectangles to the legend
        parent.legend
            .append('rect')
            .attr("x", 20)
            .attr("y", function (d, i) {
                return i * 25 + 5;
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
                d3.select('#bim_request')
                    .selectAll('.' + this.className.baseVal)
                    .transition()
                    .duration(500)
                    .attr('class', 'active')

                    .on('end',
                        function () {
                            //quantize polygons again according to sensors in them
                            d3.selectAll('.' + this.className.baseVal)
                                .transition()
                                .duration(500)
                                .attr("class", function (d) {
                                    return parent.quantize_class(parent, parent.quantize(parent.rateById.get(this.id)));
                                })
                        }
                    )
            });

        //Adds text to legend to show the extent
        parent.legend
            .append('text')
            .attr("x", 40) //leaves space after the <rect>
            .attr("y", function (d, i) {
                return i * 25 + 5;
            })
            .attr("dy", "0.8em") //place text one line *below* the x,y point
            .text(function (d, i) {
                var extent = parent.quantize.invertExtent(d);

                if (extent[0] == 1) {
                    return (' ' + extent[0] + ' sensor')
                } else if ((extent[0] < 8)) {
                    return (' ' + extent[0] + ' sensors')
                } else {
                    return ('> ' + extent[0] + ' sensors')
                }
            })
            .style("font-family", "sans-serif")
            .style("font-size", "10px");
    } // end set_legend

    //--------------------------------------------------//
    //----------------choropleth end-----------------------//
    //--------------------------------------------------//

} // end class SpaceFloor
