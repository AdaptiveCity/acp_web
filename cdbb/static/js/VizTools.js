"use strict";

class VizTools {

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
	console.log(d3.select(target_div))
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
}
