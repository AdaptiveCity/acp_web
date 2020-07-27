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

        // Transform parameters to scale SVG to screen
        parent.svg_transform = ""; // updated by set_svg_transform()
        this.next_color = 0;
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

    }

    // Use BIM api to get data for this floor
    get_floor_crate(parent) {
        var request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
            var crate_obj = JSON.parse(request.responseText)
            // Note the BIM api returns a list
            parent.handle_floor_crate(parent, crate_obj[0]);
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

        parent.append_svg(parent,xml.querySelector('#bim_request'));

        let polygons = parent.page_floor_svg.querySelectorAll("polygon");

        console.log("handle_floor_svg",polygons.length,"polygons");

        parent.set_svg_transform(parent, polygons);

        // embed the SVG map
        //let svgMap = xml.getElementsByTagName("g")[0]; // set svgMap to root g

        //assign all svg objects to a single global variable
        //parent.floorplan = parent.page_floor_svg.appendChild(svgMap);

        //attach polygon styling
        d3.selectAll("polygon")
            .style("stroke-width", 0.5 / scale)
            .attr("stroke", "black")
            .attr("transform",parent.svg_transform);

        //assign fill colors
        d3.select(parent.page_floor_svg).selectAll("polygon")
            .attr("class", function (d) {
                return parent.quantize_class(parent,parent.quantize(parent.rateById.get(this.id)));
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
                    return parent.quantize_class(parent,parent.quantize(parent.rateById.get(this.id)))
                });
            })
            .on('click', function (d) {
                // FLOORSPACE_LINK set in template with "crate_id" string placeholder
                window.location = FLOORSPACE_LINK .replace("crate_id",this.id);
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

        polygons.forEach( function(polygon) {
            // Get bounding box of floor polygon
            let box = parent.viz_tools.box(polygon);
            // Update max width, height found so far
            if (box.x < min_x) min_x = box.x;
            if (box.x + box.w > max_x) max_x = box.x + box.w;
            if (box.y < min_y) min_y = box.y;
            if (box.y + box.h > max_y) max_y = box.y + box.h;
            //console.log("box", box);
        });
        console.log("box min_x:",min_x,"min_y:",min_y,"max_x",max_x,"max_y",max_y);
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
        parent.svg_transform = "translate("+svg_x+","+svg_y+") "+
                               "scale("+svg_scale+")";
        console.log("svg_transform",parent.svg_transform);
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

        //map crates with sensors so that rateById.get(CRATE) returns #sensors
        d3.map(sensors_in_crates, function (d, i) {
            parent.rateById.set(d.crate_id, d.sensors)
        });

        //quantize polygons again according to sensors in them
        d3.selectAll("polygon")
            .attr("class", function (d) {
                return parent.quantize_class(parent,parent.quantize(parent.rateById.get(this.id)));
            });

        //since we have the data preloaded might as well add
        //tabs with to make life easier (temporary solution ofc)
        parent.viz_tools.tabulate(sensors_in_crates, ["crate_id", "sensors"]); //render the data table

        //make invisible as default, so that users can access upon clicking on the 'sidebar'
        document.getElementById("table_content").style.display = "none";

    }

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

        //Defines legend container size, appends it
        this.legend_svg = d3.select("#legend_container")
            .append("svg")
            .attr("id", "legend_svg")
            .style("width", 100)
            .style("height", 300);

        /* Thanks to http://stackoverflow.com/users/3128209/ameliabr for tips on creating a quantized legend */
        this.legend = this.legend_svg.selectAll('g.legendEntry')
            .data(this.quantize.range())
            .enter()
            .append('g').attr('class', 'legendEntry');

        //Adds small rectangles to the legend
        this.legend
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
                                return quantize_class(parent,parent.quantize(parent.rateById.get(this.id)));
                            });
                    });

            });

        //Adds text to legend to show the extent
        this.legend
            .append('text')
            .attr("x", 40) //leaves space after the <rect>
            .attr("y", function (d, i) {
                return i * 25 + 20;
            })
            .attr("dy", "0.8em") //place text one line *below* the x,y point
            .text(function (d, i) {
                var extent = parent.quantize.invertExtent(d);
                //extent will be a two-element array, format it however you want:
                return (extent[0]==1? (extent[0]+' sensor'): (extent[0]+' sensors'))//+ " - " + extent[1]
            })
            .style("font-family", "sans-serif")
            .style("font-size", "10px");
    } // end set_legend

} // end class SpaceFloor
