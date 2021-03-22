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
        self.path_width = 3; //the widht of the ticking circumferences
        // self.stroke_width = 0.1;

        //declare total round ticking time for 360 
        self.round_time = 5 * 60 * 1000; //in ms

        //declare how many ricks we want to take to get around 360
        self.clock_steps = 60; //let's say 60 as in a clock

        //calculate the circumference
        self.circumference = 2 * Math.PI * self.radius;


        self.resolution = self.circumference / self.clock_steps; //divides the circumference (2*pi*r) and get the number of circumference divisions
        //total time is (circumf/resolution) * timeout

        //        self.round_time=self.clock_steps*self.timeout;

        self.timeout = self.round_time / self.clock_steps; //steps in ms

        self.ticker;

        self.circle_opacity = 0.85;

        self.percentage = 1; //1 is 100% aka full circle

        self.color_A = "rgb(225, 65, 118)";
        self.color_B = "rgb(108, 125, 255)";
        self.color_C = "rgb(225, 65, 118)";

        self.data;

        self.svg_canvas = master.svg_canvas;;

    }


    start_timer(self) {
        //let self = this;
        let c = [self.master.spacing + self.x, self.master.spacing + self.y]; //[250, 250]; // center
        let r = self.radius // radius


        console.log('pos', c)
        let complete = self.percentage; // percent

        let circlePath = `
M ${c[0]} ${c[1]-r} 
a ${r},${r} 0 1,0 0, ${(r * 2)} 
a ${r},${r} 0 1,0 0, -${(r * 2)}
Z
`;
        let colorInterpolator = d3.interpolateRgbBasis([self.color_A, self.color_B, self.color_C]);


        let colorHandler = (d, i, nodes) => {
            let color = d3.color(colorInterpolator(d.t));
            color.opacity = i / nodes.length > 1 - complete ? 1 : 0;
            return color;
        };

        //let path = d3.select("path").attr("d", circlePath).remove();
        let instantiate_path = d3.select('#' + self.acp_id + '_parent')
            .append('g')
            .attr('id', self.acp_id + '_path_container')
            .append('path')
            .attr('id', self.acp_id + '_path')
            .attr('fill', 'none')
        // .attr('stroke-width', 10);


        let path = d3.select('#' + self.acp_id + '_path').attr("d", circlePath).remove();

        console.time("[gradient stroke performance]");
        console.log('PATH', path)
        self.data = self.quads(self.samples(path.node(), self.resolution))

        let instantiate_ticker = d3.select('#' + self.acp_id + '_path_container').selectAll("path") //.select('#main_canvas')
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

        console.timeEnd("[gradient stroke performance]");

        console.time('[TOTAL TIMER ' + self.acp_id + ']');

        self.counter = 0;

        //tick tock
        self.advance_timer();
    }

    //deletesthe ticker
    kill_timer(self) {
        //delete the rest of circle
        console.timeEnd('[TOTAL TIMER ' + self.acp_id + ']');

        console.log('ticker', self.ticker);
        clearTimeout(self.ticker);
        console.log('killing', '#' + self.acp_id + '_path_container')
        document.getElementById(self.acp_id + '_path_container').remove();
    }

    restart_timer(self) {
        //kill what's left
        self.kill_timer(self);
        console.timeEnd('[TOTAL TIMER ' + self.acp_id + ']');

        //restart from the beginning

        self.start_timer(self);

        console.log('state', self.acp_id, self.counter)
    }


    make_circle(self) {
        //let self = this;
        //draw sensors as circles
        self.svg_canvas = self.master.svg_canvas;;
        console.log(self.acp_id, self.x, self.y)
        let a = d3.select('#main_canvas') //.selectAll(".sensors")
            //.data(dataset)
            //.enter()
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
            }).attr('z-index', -1)
            .style('opacity', self.circle_opacity);

        console.log('new element', a)



        let y_txt_offset = 28;
        let x_txt_offset = 24;
        //append text tags for #of pinged + acp_ids underneath (only the nodes, text will follow)
        d3.select('#main_canvas').selectAll(".sensors")
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
        d3.select('#main_canvas').selectAll(".sensors")
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

        //iterate through all the sensors and add acp_ids to their previously predefined node locations;
        //this makes sure that sensor names have line breaks where '-' used to be, so that all text
        //fits nicely; this took waaaay too long to do and stack overflow was useless.
        //  d3.selectAll(".sensors").nodes().forEach(el => {

        // console.log('here is', el, d3.select(el))

        //extract acp_id from the dataset-acp_id property
        // let acp_id = d3.select(el).selectChild().node().dataset.acp_id;
        let acp_id_array = self.acp_id.split("-");


        //TODO TEXT IS NOW UNDER THE CIRCLE  - FIX TO CHANGE THE Z-INDEX
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
        //  })
    }


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

    advance_timer() {

        let self = this;
        if (self.counter < self.data.length) {

            self.ticker = setTimeout(() => {
                // try {

                //TODO USE THE REMOVE FUNCTION HERE
                let element = d3.select('#' + self.acp_id + '_path_' + self.counter.toString())
                //    console.log('#' + self.acp_id + '_path_' + self.counter)
                //    console.log("deleting ", element.node());
                //    console.log('del', self.counter)
                document.getElementById('#' + self.acp_id + '_path_' + self.counter.toString()).remove();

                // } catch (error) {
                // console.log('fail', error)
                //}
                self.counter++;

                self.advance_timer()


            }, self.timeout);

        } else {

            console.timeEnd('[TOTAL TIMER ' + self.acp_id + ']');

        }

    }

}