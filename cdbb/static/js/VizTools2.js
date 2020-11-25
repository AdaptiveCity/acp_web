"use strict";

class VizTools2 {

    //viz_tools is a separate class that hass useful js functions and constants for the main viz to run
    constructor() {

        this.WEEK = 86400 * 7;

        this.ICON_LOADING = '<img src="./static/images/loading_icon.gif "width="100px" height="100px" >';

        this.HALF_TAB = '&emsp;&emsp;';
        this.TAB = '&emsp;&emsp;&emsp;&emsp;';

    }

 
    array_avg(arr) {
        return (arr.reduce((a, b) => a + b, 0) / arr.length)
    }


    arrays_equal(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length != b.length) return false;

        // If you don't care about the order of the elements inside
        // the array, you should sort both arrays here.
        // Please note that calling sort on an array will modify that array.
        // you might want to clone your array first.

        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    to_timestamp(str_date) {
        let datum = Date.parse(str_date);
        return datum / 1000;
    }


    //a general mapping function that takes a value and interpolates it
    //in a different range
    map_values(value, start1, stop1, start2, stop2) {
       return (value - start1) / (stop1 - start1) * (stop2 - start2) + start2;              
    }

    //D3 tools to make life easier

    //configure canvas size and margins, returns and object
    //(width, height,top, right, bottom, left)
    canvas_conf(w, h, t, r, b,l){
        return {width:w-l-r, height:h-t-b,top:t, right:r, bottom:b, left:l}
	}

	//create a canvas with predefined settings
	make_canvas(conf, target_div, transformation){
	//conf is a an object returned by the func above
	//target_div is a string with a selected class/id e.g. '#chart_tooltip'
	//transformation defines location, it is a string e.g. 'translate(0,0)'
	return d3.select(target_div)
		 		.append("svg")
	 			.attr("width", conf.width + conf.left + conf.right)
	 			.attr("height", conf.height + conf.top + conf.bottom)
		 		.append("g")
		 		.attr("transform",transformation);		                                                    
	}

	//add text to any location on the svg
	add_text(svg_target,txt, x_pos,y_pos,font_size,transformation){
		//transformation defines location, it is a string e.g. 'translate(0,0)'
		return svg_target
				.append("g")
           		.append("text")
           		.attr("x", x_pos)
                .attr("y", y_pos)
                .attr("dy", font_size)
                .attr("text-anchor", "middle")
                .attr("transform", transformation)
          		.text(txt);		
	}

//---------------HIGH LEVEL FUNCTIONS FOR TOOLTIPS----------------//

 draw_cbar(d, feature,target_div) {

    //(width, height, top, right, bottom, left)
    let c_conf = this.canvas_conf(250, 38, 5, 30, 15, 5);
    let cbar_svg = this.make_canvas(c_conf, target_div, "translate(" + c_conf.left + "," + c_conf.top + ")");

    //map the sensor values to the colorbar location
    let raw_value = jsonPath(d, feature['jsonpath'])[0]
    console.log('d',d,'feature',feature,'rawval',raw_value)
    let mapped_value = parseInt(this.map_values(raw_value, feature.range[0], feature.range[1], 0, c_conf.width));

    // append the svg object to the body of the page
    let x_bar_offset = 15;
    let x_range_offset = -8;

    var colorScale = d3.scaleSequential(d3.interpolateWarm)
        .domain([0, c_conf.width])

    //create a series of bars comprised of small rects to create a gradient illusion
    let bar = cbar_svg.selectAll(".bars")
        .data(d3.range(c_conf.width), function (d) {
            return d;
        })
        .enter().append("rect")
        .attr("class", "bars")
        .attr("x", function (i) {
            return i + x_bar_offset;
        })
        .attr("y", 0)
        .attr("height", c_conf.height)
        .attr("width", 1)
        .style("fill", function (d, i) {
            //if the i'th element is the same as the mapped reading value, draw a black line instead
            if (i == mapped_value) {
                return 'black'
            } else return colorScale(d);
        });

    //text showing range on left/right
    //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
    this.add_text(cbar_svg, feature.range[0], x_range_offset, 0, "0.75em", "translate(0,0) rotate(-90)") // 0 is the offset from the left
    this.add_text(cbar_svg, feature.range[1], x_range_offset, 3, "0.75em", "translate(" +(c_conf.width+x_bar_offset)+ ",0) rotate(-90)") // 3 is the offset from the right

    let value_type = this.add_text(cbar_svg, feature.name, x_bar_offset + 3, 3, "0.75em", "translate(0,0)") // 6 is the offset from the right
    value_type
        .style("text-anchor", "start")
        .style('fill', 'white')
        .style('fill-opacity', '60%');


    //actual value under the black bar
    this.add_text(cbar_svg, raw_value, mapped_value + x_bar_offset, 22, "0.75em", "translate(" + 0 + ",0)") // 3 is the offset from the right

    //drop one line
    cbar_svg = d3.select(target_div)
        .append("g")
        .html("<br>");
}

//draw an 8x8 matrix for elsys-eye sensors
 draw_heatmap(d,target_div) {
    //list for reformatted data
    let grid_data = [];

    //data cleanup
    for (let i = 0; i < d.payload_cooked.grideye.length; i++) {
        grid_data.push({
            'value': d.payload_cooked.grideye[i],
            'id': i,
            'y_pos': Math.floor(i / 8),
            'x_pos': Math.floor(i % 8)
        });
    }

  	let c_conf = this.canvas_conf(250, 250, 15, 15, 15, 15);
    let h8x8_svg = this.make_canvas(c_conf, target_div, "translate(" + c_conf.left + "," + c_conf.top + ")");

    // Labels of row and columns
    let rows = [0, 1, 2, 3, 4, 5, 6, 7];
    let columns = [0, 1, 2, 3, 4, 5, 6, 7];

    // Build X scales and axis:
    let x = d3.scaleBand()
        .range([0, c_conf.width])
        .domain(rows)
        .padding(0.01);

    // Build X scales and axis:
    let y = d3.scaleBand()
        .range([0, c_conf.height])
        .domain(columns)
        .padding(0.01);

    // Build color scale
    let color_range = d3.scaleSequential(d3.interpolateTurbo)
        .domain([-5, 35])//min temp -5, max 35

    h8x8_svg.selectAll()
        .data(grid_data, function (d, i) {
            return d;
        })
        .enter()
        .append("rect")
        .attr("x", function (d) {
            return x(d.x_pos)
        })
        .attr("y", function (d) {
            return y(d.y_pos)
        })
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", function (d) {
            return color_range(d.value)
        });

    // console.log('showing 8x8', grid_data)
}


}
