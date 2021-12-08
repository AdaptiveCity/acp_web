"use strict"

// uses:
//   API_READINGS_INFO
//   API_SENSORS_INFO
//   SENSOR_LINK
//   js/parse_readings.js

// Assumes the page has a <div id="tooltop" class="tooltip">

class VizTools {
    //----------------------------------------------//
    //--------------TABLE definition----------------//
    //----------------------------------------------//

    constructor() {
    }

    init() {
        this.tooltip_div = d3.select('#tooltip');
        this.parse_readings = new ParseReadings();
    }

    //----------------------------------------------//
    //---------------TOOLTIP definition-------------//
    //----------------------------------------------//

    tooltips() {
        self = this;
        var previous_circle_radius;

        d3.selectAll("circle") // For new circle, go through the update process
            .on("mouseover", function () {
                previous_circle_radius = this.r.baseVal.value;

                d3.select(this).transition().duration(250)
                    .attr("r", previous_circle_radius * 1.5);

                // Specify where to put label of text
                let x = d3.event.pageX - document.getElementById('drawing_svg').getBoundingClientRect().x +50;
                let y = d3.event.pageY - document.getElementById('drawing_svg').getBoundingClientRect().y +50;

                console.log(x, y);

                var sensor_id = this.id;

                //define sensor name on the tooltips
                //self.tooltip_div.attr("id", sensor_id + "-text");

                //make tooltip appear smoothly
                self.tooltip_div.transition()
                    .duration(200)
                    .style("opacity", .9);

                    //console.log('tooltips() raw', received_data)
                    let reading = API_READINGS_INFO["reading"];
                    let sensor_metadata = API_SENSORS_INFO["sensors"][sensor_id];
                    let reading_obj = self.parse_readings.parse_reading(reading, sensor_metadata);
                    let tooltip_info = self.parsed_reading_to_html(reading_obj);
                    console.log('tooltips() parsed_reading:', reading_obj);

                    self.tooltip_div.html(sensor_id + "<br/>" + tooltip_info) //+ "<br/>" + "acp_sensor"
                        .style("left", (x) + "px")
                        .style("top", (y) + "px")
                        .style("display","block");

            })
            .on("mouseout", function (d) {

                self.tooltip_div.transition()
                    .duration(500)
                    .style("opacity", 0);

                d3.select(this).transition()
                    .duration(250)
                    .attr("r", previous_circle_radius);

            })
            // On a user 'click' of a sensor icon, jump to the 'sensor' page.
            .on('click', function (d) {
                let sensor_id = this.id;
                let sensor_url = SENSOR_LINK.replace('acp_id', sensor_id);
                console.log('click', sensor_url)
                window.location = sensor_url;
            });

    }

    parsed_reading_to_html(reading_obj) {
        if (reading_obj == null) {
            return ["<br/>no data"];
        }
        let formatted = []
        for (let [key, value_obj] of Object.entries(reading_obj)) {
            let feature_name = value_obj["name"];
            let feature_value = value_obj["value"];

            formatted.push("<br>" + `${feature_name}: ${feature_value}`);
        }
        return formatted
    }

    //----------------------------------------------//
    //------------------TOOLTIP end-----------------//
    //----------------------------------------------//

    //--------------------------------------------------//
    //------------------ZOOM definition-----------------//
    //--------------------------------------------------//

    zoomed(d) {
        /* Thanks to http://complextosimple.blogspot.ie/2012/10/zoom-and-center-with-d3.html 	*/
        /* This function centers the room's bounding box in the map container		*/

        console.log("VizTools zoomed()");

        //resize all cirlces on screen upon zoom

        d3.selectAll("circle").transition()
            .duration(1000)
            .attr("r", 8)
            .style("opacity", 1);

        /* The scale is set to the minimum value that enables the room to fit in the	*/
        /* container, horizontally or vertically, up to a maximum value of 3.			*/
        var box = this.getBoundingBox(d); /* get top left co-ordinates and width and height 	*/
        console.log(box);

        /* zoom into new room */
        console.log("zoomed() resetting")

        /* scale is the max number of times bounding box will fit into container, capped at 3 times */
        var scale = Math.min(mw / box.w, mh / box.h, 3);

        /* tx and ty are the translations of the x and y co-ordinates */
        /* the translation centers the bounding box in the container  */
        var tx = -box.x + (mw - box.w * scale) / (2 * scale);
        var ty = -box.y + (mh - box.h * scale) / (2 * scale);

        main_chart_svg.selectAll("#bim_request").attr("transform", "scale(" + scale + ")translate(" +
            tx + "," + ty +
            ")");

        //set surrounding polygons as inactive (fills in them white)
        d3.selectAll('polygon').attr('class','inactive');
        //set zoomed() object to active (fills in orange)
        d.attr('class','active');

        /* If the full width of container is not required, the room is horizontally centred */
        /* Likewise, if the full height of the container is not required, the room is	*/
        /* vertically centred.								*/
    }

    // Return { x,y,cx,cy,w,h } for a 'selection'
    //DEBUG need to clarify 'selection'
    getBoundingBox(selection) {
        /* get x,y co-ordinates of top-left of bounding box and width and height */
        var element = selection.node();
        return this.box(element);
    }

    // Return { x,y,cx,cy,w,h } for an html DOM element (for us often SVG)
    box(element) {
        //console.log('box called with element', element);
        var bbox = element.getBBox();
        var cx = bbox.x + bbox.width / 2;
        var cy = bbox.y + bbox.height / 2;
        //console.log('box bbox=', bbox);
        return { x: bbox.x,  y: bbox.y, cx: cx, cy: cy, w: bbox.width, h: bbox.height };
    }

    //--------------------------------------------------//
    //----------------------ZOOM end--------------------//
    //--------------------------------------------------//

    // point_in_crate returns 'true' if point is inside the boundary of crate 'crate_id'
    point_in_crate(crate_id, point) {
        let polygon=d3.select('#'+crate_id)._groups[0][0].points;
        //A point is in a polygon if a line from the point to infinity crosses the polygon an odd number of times
        let odd = false;
        //For each edge (In this case for each point of the polygon and the previous one)
        for (let i = 0, j = polygon.length - 1; i < polygon.length; i++) {
            //If a line from the point into infinity crosses this edge
            if (((polygon[i].y > point[1]) !== (polygon[j].y > point[1])) // One point needs to be above, one below our y coordinate
                // ...and the edge doesn't cross our Y corrdinate before our x coordinate (but between our x coordinate and infinity)
                && (point[0] < ((polygon[j].x - polygon[i].x) * (point[1] - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x))) {
                // Invert odd
                odd = !odd;
            }
            j = i;

        }
        //If the number of crossings was odd, the point is in the polygon
        return odd;
    }

    //--------------------------------------------------//
    //----------------HEATMAP definition----------------//
    //--------------------------------------------------//

    //temporary solution to create a heatmap
    obtain_sensors_in_crates(){
        //crates will house crate_id/sensors object pairs
        let crates=[];
        //fill the crates array with crate_ids and # of sensors
        d3.selectAll('polygon')._groups[0].forEach( crate => crates.push( {'crate_id':crate.id, 'sensors':0} ));
        //get the list of sensors by looking at the attached circles
        let sensors=d3.selectAll('circle')._groups[0];

        for(let i=0; i<crates.length;i++){
            //select crate
            let crate=crates[i].crate_id;
            //get sensor count for that crate
            crates[i].sensors = this.get_count_for_crate(sensors,crate);
        }
        return crates;
    }

    //looks at a crate and returns the number of sensors in it
    get_count_for_crate(sensors,crate_id){

        let count=0;
        //iterate over the sensor (circles) array
        for(let i=0; i<sensors.length;i++){

            let sensor=sensors[i];
            //acquire x/y positions for a sensor
            let point=[sensor.cx.baseVal.value, sensor.cy.baseVal.value];
            //if sensor is within a crate
            if(this.point_in_crate(crate_id, point)){
                count++;
            }

        }
       return count;
    }
    //--------------------------------------------------//
    //----------------HEATMAP end-----------------------//
    //--------------------------------------------------//

    get_building_coordinates() {
        let drawing_svg = d3.select("#drawing_svg");
        drawing_svg.on("click", function () {
            console.log("node", d3.mouse(this));
        })
    }


} // end class VizTools
