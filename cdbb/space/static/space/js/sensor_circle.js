"use strict"

class SensorCircle {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(master, meta) {
        let self = this;
        self.master = master;

        //declare coordinates for the sensor circle
        self.x = meta.x;
        self.y = meta.y;
        self.acp_id = meta.acp_id;

        self.radius = master.CIRCLE_RADIUS;
        self.path_width = 3; //the width of the ticking circumferences
        // self.stroke_width = 0.1;
        self.circle_opacity = 0.85;

        //declare total round ticking time for 360 
        self.round_time = 5 * 60 * 1000; //in ms [SET FOR 5 MINS]

        //declare how many ricks we want to take to get around 360
        self.clock_steps = 60; //let's say 60 as in a clock

        //calculate the circumference
        self.circumference = 2 * Math.PI * self.radius;

        self.resolution = self.circumference / self.clock_steps; //divides the circumference (2*pi*r) and get the number of circumference divisions
        //total time is (circumf/resolution) * timeout

        self.timeout = self.round_time / self.clock_steps; //steps in ms

        //circle completeness
        self.percentage = 1; //1 is 100% aka full circle

        //the color gradient goes A->B->C
        self.color_A = "rgb(225, 65, 255)"; //pink
        self.color_B = "rgb(108, 125, 255)"; //violet
        self.color_C = "rgb(225, 65, 118)"; //red

        //parent svg element, usually '#main_canvas'
        self.svg_canvas = master.svg_canvas;

        //create a global setTimeout variable so we can cancel it anytime
        self.ticker;

        //create a global for data (will have ticker circumference subdivision info)
        self.data;

    }


    //----------------------------------------------------------------------//
    //-----------TIMER FUNCTIONS: START, ADVANCE, KILL, RESTART-------------//
    //----------------------------------------------------------------------//

    start_timer(self) {
        //set the coordinates and the radius for the timer circle
        let c = [self.master.spacing + self.x, self.master.spacing + self.y]; //[250, 250]; // center
        let r = self.radius // radius

        //this sets the circle completeness aka if it starts at 100% full (360deg) or less (e.g. 50% at 180deg) 
        let complete = self.percentage; // percent

        //do the path maths for circles
        let circlePath = `
M ${c[0]} ${c[1]-r} 
a ${r},${r} 0 1,0 0, ${(r * 2)} 
a ${r},${r} 0 1,0 0, -${(r * 2)}
Z
`;
        //interpolate the color gradient from A to B to C colors defined in the constructor
        let colorInterpolator = d3.interpolateRgbBasis([self.color_A, self.color_B, self.color_C]);

        //do color wrangling from the interpolator above
        let colorHandler = (d, i, nodes) => {
            let color = d3.color(colorInterpolator(d.t));
            color.opacity = i / nodes.length > 1 - complete ? 1 : 0;
            return color;
        };

        //create a parent path object which will serve as the basis to calculate circumference's subdivisions
        let instantiate_path = d3.select('#' + self.acp_id + '_parent')
            .append('g')
            .attr('id', self.acp_id + '_path_container')
            .append('path')
            .attr('id', self.acp_id + '_path')
            .attr('fill', 'none')
        // .attr('stroke-width', 10);

        //using the instantiate_path above create a path variable that will be subdivided into circumference's subdivisions
        let path = d3.select('#' + self.acp_id + '_path').attr("d", circlePath).remove(); // the .remove() here is optional

        //fill the self.data global with circumference subdivision data
        self.data = self.quads(self.samples(path.node(), self.resolution))

        //create a bunch of paths that are circumference's subdivisions
        let instantiate_ticker = d3.select('#' + self.acp_id + '_path_container').selectAll("path")
            .data(self.data)
            .enter().append("path")
            .attr('id', function (d, i) {
                return '#' + self.acp_id + '_path_' + (i)
            })
            .style("fill", colorHandler)
            .style("stroke", colorHandler)
            // .style("stroke-width", self.stroke_width)
            .style("stroke-linecap", (d, i, all) => i === 0 || i === all.length ? "round" : "round")
            .attr("d", d => self.lineJoin(d[0], d[1], d[2], d[3], self.path_width));

        //time it to see how accurate the timer is
        console.time('[TOTAL TIMER ' + self.acp_id + ']');

        //initiate the counter
        self.counter = 0;

        //tick tock
        self.advance_timer(self);
    }

    //deletesthe ticker
    kill_timer(self) {
        //delete the rest of circle
        console.timeEnd('[TOTAL TIMER ' + self.acp_id + ']');

        //reset the timer
        clearTimeout(self.ticker);

        //remove all the paths that were left
        document.getElementById(self.acp_id + '_path_container').remove();
    }

    //deletes and restarts the ticker
    restart_timer(self) {
        //kill what's left
        self.kill_timer(self);

        //restart from the beginning
        self.start_timer(self);
    }

    //this is the function that advances the clock surounding sensors;
    //it advances the ticking circumference by deleting a part of it
    advance_timer(self) {

        //check that the counter has not exceeded the circumference subdivisions
        if (self.counter < self.data.length) {

            //do the timer sequence
            self.ticker = setTimeout(() => {

                //delete part of the circle's circumference
                document.getElementById('#' + self.acp_id + '_path_' + self.counter.toString()).remove();

                //update the counter
                self.counter++;

                //repeat recursively
                self.advance_timer(self)

            }, self.timeout);

        } else {
            //finish the timeout sequence
            console.timeEnd('[TOTAL TIMER ' + self.acp_id + ']');
            //remove the sensor fill
            d3.select('#' + self.acp_id + '_ssd')
                .transition()
                .duration(1000)
                .attr('class', 'sensor_circles_inactive')
                .style('fill', 'rgba(0,0,0,0)');
        }

    }
    //----------------------------------------------------------------------//
    //create a sensor circle that will show if a sensors has been triggered//
    //----------------------------------------------------------------------//
    make_circle(self) {
        //draw sensors as circles
        self.svg_canvas = self.master.svg_canvas;;

        self.svg_canvas
            .append('g')
            .attr("class", "sensors")
            .attr('id', function (d, i) {
                return self.acp_id + '_parent'
            })
            .append("circle")
            .style("stroke", "gray")
            .style("stroke-width", 1)
            .style("fill", "white")
            .attr("class", "sensor_circles")
            .attr('id', function (d, i) {
                return self.acp_id + "_ssd"
            })
            .attr("data-acp_id", function (d, i) {
                return self.acp_id;
            })
            .attr("r", self.master.CIRCLE_RADIUS)
            .attr("cx", function (d, i) {
                return self.master.spacing + self.x
            })
            .attr("cy", function (d, i) {
                return self.master.spacing + self.y
            }).attr('z-index', -999)
            .style('opacity', self.circle_opacity);

        let y_txt_offset = 28;
        let x_txt_offset = 24;
        //append text tags for #of pinged + acp_ids underneath (only the nodes, text will follow)

        self.svg_canvas.select('#' + self.acp_id + '_parent')
            .append('g')
            .append("text")
            .attr('id', function (d, i) {
                return self.acp_id + '_pinged'
            })
            .attr("class", "sensor_txt")
            .style('opacity', 1)
            .style('fill', 'black')
            // .attr('z-index', 999)
            .attr("x", function (d, i) {
                return x_txt_offset + self.x
            })
            .attr("y", function (d, i) {
                return y_txt_offset + self.y
            })
            //makes sure that text is centered no matter how many digits are put inside the circle
            .attr("text-anchor", "middle")
            .style("font-size", "0.7em");

        //prepare the nodes for acp_ids (this is a bit convoluted due to how d3 (doesn't) handle multiline text)
        self.svg_canvas.select('#' + self.acp_id + '_parent')
            .append('g')
            .attr('id', function (d, i) {
                return self.acp_id + '_g'
            })
            .append("text")
            .attr('id', function (d, i) {
                return self.acp_id + '_txt'
            })
            .attr("class", "sensor_txt")
            .style('opacity', 1)
            .style('fill', 'black')
            .attr('z-index', 999)
            .style("text-anchor", "middle")
            .style("font-size", "0.65em")

        //split the sensor id into three parts
        let acp_id_array = self.acp_id.split("-");

        //add the sensor id underneath the sensor circle
        for (let u = 0; u < acp_id_array.length; u++) {
            d3.select('#' + self.acp_id + '_txt').append('tspan').text(acp_id_array[u])
                .attr('x', function (d, i) {
                    let x_offset = 25;
                    return self.x + x_offset
                })
                .attr('y', function (d, i) {
                    let line_height = 8 * (u + 1);
                    let y_offset = 40;
                    return self.y + y_offset + line_height
                })
        }
    }

    //--------------------------------------------------//
    //-------CIRCUMFERENCE SUBDIVISION FUNCTIONS--------//
    //--------------------------------------------------//

    // Sample the SVG path uniformly with the specified precision.
    samples(path, precision) {
        let n = path.getTotalLength(),
            t = [0],
            i = 0,
            dt = precision;
        while ((i += dt) < n) t.push(i);
        t.push(n);
        return t.map(function (t) {
            let p = path.getPointAtLength(t),
                a = [p.x, p.y];
            a.t = t / n;
            return a;
        });
    }

    // Compute quads of adjacent points [p0, p1, p2, p3].
    quads(points) {
        return d3.range(points.length - 1).map(function (i) {
            let a = [points[i - 1], points[i], points[i + 1], points[i + 2]];
            a.t = (points[i].t + points[i + 1].t) / 2;
            return a;
        });
    }

    // Compute stroke outline for segment p12.
    lineJoin(p0, p1, p2, p3, width) {
        let self = this;

        let u12 = self.perp(p1, p2),
            r = width / 2,
            a = [p1[0] + u12[0] * r, p1[1] + u12[1] * r],
            b = [p2[0] + u12[0] * r, p2[1] + u12[1] * r],
            c = [p2[0] - u12[0] * r, p2[1] - u12[1] * r],
            d = [p1[0] - u12[0] * r, p1[1] - u12[1] * r];

        if (p0) { // clip ad and dc using average of u01 and u12
            let u01 = self.perp(p0, p1),
                e = [p1[0] + u01[0] + u12[0], p1[1] + u01[1] + u12[1]];
            a = self.lineIntersect(p1, e, a, b);
            d = self.lineIntersect(p1, e, d, c);
        }

        if (p3) { // clip ab and dc using average of u12 and u23
            let u23 = self.perp(p2, p3),
                e = [p2[0] + u23[0] + u12[0], p2[1] + u23[1] + u12[1]];
            b = self.lineIntersect(p2, e, a, b);
            c = self.lineIntersect(p2, e, d, c);
        }

        return "M" + a + "L" + b + " " + c + " " + d + "Z";
    }

    // Compute intersection of two infinite lines ab and cd.
    lineIntersect(a, b, c, d) {
        let x1 = c[0],
            x3 = a[0],
            x21 = d[0] - x1,
            x43 = b[0] - x3,
            y1 = c[1],
            y3 = a[1],
            y21 = d[1] - y1,
            y43 = b[1] - y3,
            ua = (x43 * (y1 - y3) - y43 * (x1 - x3)) / (y43 * x21 - x43 * y21);
        return [x1 + ua * x21, y1 + ua * y21];
    }

    // Compute unit vector perpendicular to p01.
    perp(p0, p1) {
        let u01x = p0[1] - p1[1],
            u01y = p1[0] - p0[0],
            u01d = Math.sqrt(u01x * u01x + u01y * u01y);
        return [u01x / u01d, u01y / u01d];
    }

}