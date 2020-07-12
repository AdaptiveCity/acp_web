"use strict"

/*
This is the JS for page template 'building.html' to provide a rendered view of a BUILDING.

Dependencies (static/js):
    viz_tools.js
    d3
*/

class SpaceBuilding {

    // Called to create instance in page : space_building = SpaceBuilding()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();

        // vertical offset for drawn floors (in pixels)

        this.y_offset = 110;
        // rotating colors for drawn floors
        this.floor_colors = ['#ff8888', '#ffff88', '#88ff88'];

        // Transform parameters to scale SVG to screen
        // Will be updated in handle_building_space_data()
        this.svg_scale = 1;
        this.svg_x = 0;    // x,y point of top-left corner
        this.svg_y = 0;
        this.svg_cx = 0; // x,y point for center of rotation
        this.svg_cy = 0;
        this.svg_floor_offset = 0; // y offset when drawing each floor
        this.svg_max_floor = 0; // Floor number of top floor
        this.next_color = 0;

    }

    // init() called when page loaded
    init() {
        var parent = this;

        // Page template DOM elements we'll update
        this.page_draw_div = document.getElementById("main_drawing_div");
        this.page_floor_svg = document.getElementById("drawing_svg"); // drawing SVG element
        this.page_coords = document.getElementById("drawing_coords");

        // debug for page x,y coordinates
        this.page_floor_svg.addEventListener('mousemove', function (e) {
            //parent.page_coords.innerHTML = e.clientX + "," + e.clientY;
        });

        // Do an http request to the SPACE api, and call handle_building_space_data() on arrival
        this.get_building_space_data(window.CRATE_ID);
    }

    // Use SPACE api to get building and floors (as XML svg)
    get_building_space_data(crate_id) {
        var parent = this; // store current 'this' as lambda function will change that
        var request = new XMLHttpRequest();
        request.overrideMimeType('application/xml');
        request.addEventListener("load", function () {
            parent.handle_building_space_data(parent, request.responseXML); // alternatively request.responseText
        });
        var space_api_url = API_SPACE+"get/bim/"+crate_id+"/1";
        console.log("get_building_space_data() http request: "+space_api_url)
        request.open("GET", space_api_url);
        request.send();
    }

    // Iterate through the floor SVG polygons and draw them.
    handle_building_space_data(parent, xml) {
        console.log("Got SPACE data", xml);
        var polygons = xml.querySelectorAll("polygon");

        // Create a list of floor polygons (unordered)
        parent.floor_list = []
        polygons.forEach( function(polygon) {
            var crate_type = polygon.getAttribute("data-crate_type");
            // Create a list of just the 'floor' objects that can be sorted before rendering
            if (crate_type == "floor") {
                parent.floor_list.push(polygon);
                // Collect the top floor number, used to y-offset the floors on the page
                let floor_number = polygon.getAttribute("data-floor_number");
                if (floor_number > parent.svg_max_floor) {
                    parent.svg_max_floor = floor_number;
                }
            }
        });

        // Sort the list of floors by their data-floor_number properties
        parent.floor_list.sort( function(a,b) {
            var a_floor_number = a.getAttribute("data-floor_number");
            var b_floor_number = b.getAttribute("data-floor_number");
            return a_floor_number - b_floor_number;
        });

        // Append each floor to page SVG but keep invisible for now
        // After appending the floor SVG's, we will calculate the scale & xy transform
        var max_w = 0;
        var max_h = 0;
        var min_x = 99999;
        var min_y = 99999;

        parent.floor_list.forEach( function(polygon) {
            // Note we have to append the DOM object to the page for getBBox to work
            parent.append_floor(parent, polygon);
            // Get bounding box of floor polygon
            var box = parent.viz_tools.box(polygon);
            // Update max width, height found so far
            if (box.w > max_w) max_w = box.w;
            if (box.h > max_h) max_h = box.h;
            if (box.x < min_x) min_x = box.x;
            if (box.y < min_y) min_y = box.y;
            console.log("box", box);
        });
        console.log("box min_x:",min_x,"min_y:",min_y,"max_w",max_w,"max_h",max_h);
        // calculate appropriate scale for svg
        var diagonal = Math.sqrt(max_w * max_w + max_h * max_h);
        var w = parent.page_floor_svg.clientWidth;
        var h = parent.page_floor_svg.clientHeight;

        // Set the svg scale to fit either x or y
        parent.svg_scale = 0.6 * (w < h ? w / diagonal : h / diagonal);
        // x offset
        parent.svg_x = -min_x;
        // y offset, leaving space for floors 1+ and rotation
        let rotation_y_adj = diagonal - max_h;
        let upper_floors_y_adj = parent.svg_max_floor * 100 / parent.svg_scale;
        parent.svg_y = -min_y + rotation_y_adj + upper_floors_y_adj;
        // Center of rotation
        parent.svg_cx = Math.round(max_w / 2);
        parent.svg_cy = Math.round(max_h / 2);
        // offset per floor
        parent.svg_floor_offset = parent.svg_scale * max_h / 4 ;

        console.log("x:",parent.svg_x,"y:",parent.svg_y,"scale:",parent.svg_scale,"cx:",parent.svg_cx,"cy:",parent.svg_cy );

        // Now iterate the floors from bottom to top, and draw them at required scale:
        parent.floor_list.forEach( function(polygon) {
            var polygon_id = polygon.getAttribute("id");
            parent.draw_floor(parent, polygon_id, polygon);
        });

        // All SVG's drawn, so make visible
        parent.loaded();
    }

    // Add the floor svg objects to the DOM parent SVG (but invisible)
    append_floor(parent, floor_svg) {
        // note viz_tools.box returns ZEROs if used before the appendChild()
        //console.log("box before render", parent.viz_tools.box(floor_svg));
		var floorplan = parent.page_floor_svg.appendChild(floor_svg); //svgMap /* floorplan */

        // Now we've done the appendChild we can work out the bounding box and the scale
		//make invisible prior loading
		d3.select(floorplan).style("opacity", 0);
    }

    // Translate / Scale / Rotate the floor SVG
    draw_floor(parent, crate_id, floor_svg) {
        // get the floor_number embedded in the svg object data-floor_number property by the space API
        let floor_number = floor_svg.getAttribute("data-floor_number");

        // From floor_number calculate a suitable vertical offset and floor display color
        let color = parent.floor_colors[parent.next_color++ % parent.floor_colors.length];

        let x_off = parent.svg_x * parent.svg_scale;
        let y_off = parent.svg_y * parent.svg_scale - parent.svg_floor_offset * floor_number;
        let cx = parent.svg_cx * parent.svg_scale;
        let cy = parent.svg_cy * parent.svg_scale;
        var svg_transform = "translate("+ Math.round(x_off) + ","
                                        + Math.round(y_off) + ") " +
                            "rotate(-20,0,0) " + //-45
                            "scale("+parent.svg_scale+") ";

        console.log(y_off, svg_transform);
		//attach css styling and add mouse events
		d3.select('#'+crate_id)
            .style("stroke-width", 0.5 / parent.svg_scale)
            .attr("stroke", "black")
            .attr('fill', color)
            //.attr('id', 'floor_' + crate_id)
            .attr('class', 'floor')
			//---on click load floor page---//
			.on('click', function () {
				window.location = '/wgb/floor/' + crate_id
			})
			//---on mouseover make other floors less visible---//
			.on('mouseover', function () {
                //console.log("mouseover",crate_id);
                return parent.mouse_over_floor(parent, crate_id);
			})
			//---on mouseout make everything visible the same amount---//
			.on('mouseout', function () {
				d3.selectAll('.floor')
                    .transition()
                    .duration(250)
                    .style("stroke-width", 0.5)
                    .style("opacity", 1);
			})
            //.attr("transform","translate("+x_off+","+y_off+") scale("+parent.svg_scale+")")
            //.attr("transform","translate(-10,-25) rotate(0,12,12) scale(2)")
            .attr("transform", svg_transform);

		//d3.select(floorplan).attr("transform", "translate(0," + (450 - y_off) + ") rotate(-45) scale(1)");
    }

    //after loading all three floors make SVGs visible
    loaded() {
    	d3.selectAll('.floor').transition().duration(500).style("opacity", 1).style("stroke-width", 0.5);
    }

    // Highlight the floor the mouse is hovering over
    mouse_over_floor(parent, crate_id) {
        parent.floor_list.forEach( function(crate) {
            let floor_crate_id = crate.getAttribute("id");
            if (floor_crate_id != crate_id) {
                //is not selected, make less visible
                //console.log("less visible", floor_crate_id);
                d3.select('#' + floor_crate_id).transition().duration(250).style("opacity", 0.3).style("stroke-width", 0.5);
            } else {
                //is selected make sharper
                //console.log("more visible", floor_crate_id);
                d3.select('#' + floor_crate_id).transition().duration(250).style("opacity", 1).style("stroke-width", 1);
            }
        })
    }

} // end class SpaceBuilding
