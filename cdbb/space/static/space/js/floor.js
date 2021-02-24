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

        // Instantiate a Heatmap class
        this.heatmap = new HeatMap(this); //initiated at the end of init so we can preload data

        // Instantiate a Splah class
        this.splash = new SplashMap(this);
      
        // Transform parameters to scale SVG to screen
        this.svg_transform = ""; // updated by set_svg_transform()
        this.next_color = 0;
        this.sensor_data; //metadata
        this.sensor_readings = {}; //sensor reading data
        this.sensors_in_crates = {};
    }

    // init() called when page loaded
    init() {
        var parent = this;

        //start helper functions object
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

        //Determines choropleth's color scheme
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
        parent.rateById = new Map(); //d3 v6 standard

        //Other global variables

        this.previous_circle_radius = 0; // set on mouse over, used to remember radius for reset on mouse out.
        this.defaultScale = 1; /* default scale of map - fits nicely on standard screen */

        this.set_legend(parent);

        // Do an http request to the SPACE api, and call handle_building_space_data() on arrival
        this.get_floor_crate(parent);

        //--------------------------------------//
        //--------SET UP EVENT LISTENERS--------//
        //--------------------------------------//


        //Set up event listener to RESET FLOORPLAN/HEATMAP
        document.getElementById('reset_zoom').addEventListener('click', () => {
            parent.manage_zoom.reset(parent);
        })


        //Set up slider to change sensor opacity
        let slider = document.getElementById("sensor_opacity");
        this.sensor_opacity = slider.value; // Display the default slider value

        // Update the current slider value (each time you drag the slider handle)
        slider.oninput = function () {
            let opacity_value = this.value / 100;
            parent.change_sensor_opacity(parent, opacity_value);
        }
        //--------------------------------------//
        //----------END EVENT LISTENERS---------//
        //--------------------------------------//
        
        //declare zooming/panning function
        parent.manage_zoom(parent)
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

        // //once all of the data is loaded/svg rendered, init the heatmap in the background
        // parent.heatmap.init()

    }

    //TODO-modify for real vs fake sensors
    //changes sensor opacity
    change_sensor_opacity(parent, new_opacity) {
        //set new opacity
        // d3.selectAll('.non_heatmap_circle').style('opacity', new_opacity);

        //if debug set the fake data sensor called sensor nodes
        d3.selectAll('.sensor_node').style('opacity', new_opacity);
    }

    //allows to scroll into the floorplan/heatmap
    manage_zoom(parent) {

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
        function zoomed({
            transform
        }) {
            d3.select('#bim_request').attr("transform", transform);
            d3.select('#heatmap').attr("transform", transform);
            d3.select('#heatmap_sensors').attr("transform", transform);
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
            //console.log("box", box);
        });

        //console.log("box min_x:", min_x, "min_y:", min_y, "max_x", max_x, "max_y", max_y);

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

        //console.log("svg_transform", parent.svg_transform);
    }

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
                let x_value = results[sensor]['acp_location_xyz']['x']
                // Note y is NEGATIVE for XYZF (anti-clockwise) -> SVG (clockwise)
                let y_value = -results[sensor]['acp_location_xyz']['y']
                let floor_id = results[sensor]['acp_location_xyz']['f']
                let sensor_id = results[sensor]['acp_id'];

                //draw sensors on screen
                d3.select("#bim_request").append("circle")
                    .attr("cx", x_value)
                    .attr("cy", y_value)
                    .attr("r", rad)
                    .attr("id", sensor_id)
                    .attr("class", 'non_heatmap_circle')
                    .style("opacity", opac)
                    .style("fill", "purple")
                    .attr("transform", parent.svg_transform);

            } catch (error) {
                console.log(error)
            }

        }
        //activate tooltips on hover
        parent.viz_tools.tooltips();
        //fill polygons based on # of sensors 
        parent.get_choropleth(parent);
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

    //color polygons based on the number of sensors in them
    get_choropleth(parent) {

        //make drawn floorplan polygons interactive
        d3.selectAll('polygon').attr('pointer-events', 'all');

        parent.sensors_in_crates = parent.obtain_sensors_in_crates(parent);

        //map crates with sensors so that rateById.get(CRATE) returns #sensors
        d3.map(parent.sensors_in_crates, function (d, i) {
            parent.rateById.set(d.crate_id, d.sensors)
        });

        //quantize polygons again according to sensors in them
        d3.selectAll("polygon")
            .attr("class", function (d) {
                return parent.quantize_class(parent, parent.quantize(parent.rateById.get(this.id)));
            })

    }
    //--------------------------------------------------//
    //----------------choropleth end-----------------------//
    //--------------------------------------------------//



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