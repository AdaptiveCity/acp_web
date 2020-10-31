"use strict"
// uses ACP_IP, API_READINGS, SENSOR_REALTIME set in template

// This codes requests a DAY sensor READINGS, with "&metadata=true" appended to
// the readings api url, so a json object { readings: [...], sensor_metadata: { } } is
// returned. The metadata defines each of the 'features' (e.g. temperature) available
// in the returned readings. Consequently this code does not need to call the
// sensors api separately (which the readings api will do server-side anyway)

var plot_date; // date of currently displayed plot (initialized from YYYY/MM/DD)

var feature_jsonpath_ts = '$.acp_ts'; // timestamp

var loading_el; // loading element animated gif
var reading_popup_el; // div to display full reading json
var feature_select_el; // feature select element
var chart_tooltip_el;
var zoom_hint_el; // div containing zoom/unzoom hint message

// Chart parameters
var chart_width;
var chart_height;
var chart_svg; // chart svg element
var chart_graph; // chart svg element


// Called on page load
function init() {

    // Set plot_date to today, or date given in URL (& parsed into template)
    if (YYYY == '') {
        plot_date = new Date().toISOString().split('T')[0];
    } else {
        plot_date = YYYY + '-' + MM + '-' + DD;
    }

    // Animated "loading" gif, shows until readings are loaded from api
    loading_el = document.getElementById('loading');
    zoom_hint_el = document.getElementById('zoom_hint');
    feature_select_el = document.getElementById("form_feature");
    chart_tooltip_el = d3.select('#chart_tooltip'); //document.getElementById('chart_tooltip');

    // The cool date picker
    var form_date = document.getElementById("form_date");

    form_date.setAttribute('value', plot_date);

    set_zoom_hint(true); // Put 'drag to zoom' text in the zoom hint div

    init_reading_popup();

    // set up layout / axes of scatterplot
    init_chart();

    // Can use get_local_readings() to shim the API (copywrite jb2328)
    //get_local_readings();
    get_readings();

}

// Use API_READINGS to retrieve requested sensor readings
function get_readings() {
    var readings_url = API_READINGS + 'get_day/' + ACP_ID + '/' +
                      '?date=' + plot_date +
                      '&metadata=true';

    console.log("using readings URL: "+readings_url);

    var jsonData = $.ajax({
      url: readings_url,
      dataType: 'json',
      async: true,
      headers: {"Access-Control-Allow-Origin": "*"},
    }).done(handle_readings);
  }

// Alternative to get_readings() using local file for sensors API response
function get_local_readings() {
    console.log('loading data')

    d3.json("sample_8x8_data.json").then(function (data) {
        handle_readings(data);
        console.log(data)
    });
  }


// API http call has returned these results { readings: ..., sensor_metadata: ...}
function handle_readings(results) {
    console.log('handle_readings()', results);

    if ('acp_error_id' in results) {
        let error_id = results['acp_error_id'];
        console.log('handle_readings() error', results);
        if (error_id == 'NO_READINGS') {
            report_error(error_id, 'NO READINGS available for this sensor.');
            return;
        }
    }

    let readings = results["readings"];

    let sensor_metadata = results["sensor_metadata"];

    loading_el.className = 'loading_hide'; // set style "display: none"

    let features = handle_sensor_metadata(sensor_metadata);

    // Setup onchange callbacks to update chart on feature or date changes
    let feature = init_feature_select(readings, features);

    if (feature != null) {
        set_date_onclicks(feature['feature_id']);

        draw_chart(readings, feature);
    } else {
        report_error('FEATURE', 'Metadata not available for this sensor.');
    }
}

// Populate the 'select' area at the top of the page using info from
// the sensor metadata, e.g. the list of 'features'.
function handle_sensor_metadata(sensor_metadata) {
    try {
        let features = sensor_metadata["acp_type_info"]["features"];
        return features;
    } catch (err) {
        console.log('handle_sensor_metadata failed with ', sensor_metadata);
    }
    return [];
}

function init_feature_select(readings, features) {
    console.log("init_feature_select()");
    // ***************************************
    // Update selection dropdown on page
    // ***************************************
    // remove any initial entries
    while (feature_select_el.firstChild) {
        feature_select_el.removeChild(feature_select_el.firstChild)
    }

    let selected_feature = null; // Will return this value

    let feature_count = 0;
    // add a select option for each feature in the sensor metadata
    for (const feature in features) {
        console.log("feature: " + feature);
        feature_count += 1;
        const option = document.createElement('option');
        const text = document.createTextNode(features[feature]["short_name"]);
        // set option text
        option.appendChild(text);
        // and option value
        option.setAttribute('value', feature);
        // add the option to the select box
        feature_select_el.appendChild(option);
    }

    if (feature_count == 0) {
        console.log("No features listed in sensor_metadata");
        return null;
    } else if (FEATURE == '') {
        console.log("No feature given in page request");
        for (const feature in features) {
            console.log("Defaulting to feature " + feature);
            let feature_id = feature;
            selected_feature = features[feature_id];
            selected_feature['feature_id'] = feature_id;
            break;
        }
    } else {
        selected_feature = features[FEATURE];
        selected_feature['feature_id'] = FEATURE;
    }

    feature_select_el.value = selected_feature['feature_id'];
    feature_select_el.onchange = function (e) {
        onchange_feature_select(e, readings, features)
    };

    return selected_feature;
}

function onchange_feature_select(e, readings, features) {
    console.log("onchange_feature_select", window.location.href);
    //let features = sensor_metadata["acp_type_info"]["features"];
    let feature_id = feature_select_el.value;

    set_date_onclicks(feature_id);
    // Change the URL in the address bar
    update_url(feature_id, plot_date);
    draw_chart(readings, features[feature_id]);
}

function set_date_onclicks(feature_id) {
    // set up onclick calls for day/week forwards/back buttons
    document.getElementById("back_1_week").onclick = function () {
        date_shift(-7, feature_id)
    };
    document.getElementById("back_1_day").onclick = function () {
        date_shift(-1, feature_id)
    };
    document.getElementById("forward_1_week").onclick = function () {
        date_shift(7, feature_id)
    };
    document.getElementById("forward_1_day").onclick = function () {
        date_shift(1, feature_id)
    };
}

function set_zoom_hint(zoom) {
    if (zoom) {
        zoom_hint_el.innerHTML = '(drag a box to zoom in)';
    } else {
        zoom_hint_el.innerHTML = '(doubleclick to zoom back out)';
    }
}

// Subscribe to RTMonitor to receive incremental data points and update chart
function plot_realtime() {
    var client_data = {};
    var VERSION = 1;
    client_data.rt_client_id = 'unknown';
    client_data.rt_token = 'unknown';
    client_data.rt_client_name = 'rtmonitor_api.js V' + VERSION;

    var URL = SENSOR_REALTIME;

    var sock = new SockJS(URL);

    sock.onopen = function () {
        console.log('open');
        var msg_obj = {
            msg_type: 'rt_connect',
            client_data: self.client_data
        };

        sock.send(JSON.stringify(msg_obj));
    };

    sock.onmessage = function (e) {
        console.log('message', e.data);
        var msg = JSON.parse(e.data);
        if (msg.msg_type != null && msg.msg_type == "rt_nok") {
            console.log('Error', e.data);
        }
        if (msg.msg_type != null && msg.msg_type == "rt_connect_ok") {
            console.log("Connected")
            var msg_obj = {
                msg_type: "rt_subscribe",
                request_id: "A",
                filters: [{
                    test: "=",
                    key: "acp_id",
                    value: "csn-node-test"
                }]
            }
            sock.send(JSON.stringify(msg_obj))
        }
        if (msg.msg_type != null && msg.msg_type == "rt_data") {
            console.log('Other', e.data)
            //var sData = getAptData();
            sData = msg.request_data[0].weight;
            console.log("sData:", sData);
            tempData.datasets[0].data.push(sData);
            tempData.datasets[0].data.shift();
            var now = new Date();
            tempData.labels.push(now.getHours());
            //DEBUG this var not used in this version of chart page
            //myNewChart.update();
        }
    };
}

// ******************************************
// Initialize the chart to appear on the page
// - not yet with any data
// ******************************************
function init_chart() {
    // get the height and width of the "chart" div, and set d3 svg element to that
    let svg_width = document.getElementById("chart").clientWidth;
    let svg_height = document.getElementById("chart").clientHeight;

    // calculate the dimensions of the actual chart within the SVG area (i.e. allowing margins for axis info)
    chart_width = svg_width - 210;
    chart_height = svg_height - 110;
    let chart_offsetx = 60;
    let chart_offsety = 20;

    // add the graph canvas to the body of the webpage
    chart_svg = d3.select("#chart").append("svg")
        .attr("width", svg_width)
        .attr("height", svg_height)
        .attr("class", "plot_svg")
        .append("g")
        .attr("transform", "translate(" + chart_offsetx + "," + chart_offsety + ")");
}

// ****************************************************************************
// *********  Update the chart with sensor readings data **********************
// ****************************************************************************
function draw_chart(readings, feature) {
    console.log('draw_chart', feature, 'size=' + readings.length, readings);

    // do nothing if no data is available
    if (readings.length == 0) return;

    var chart_xScale; // d3 scale fn for x axis
    var chart_xAxis; // x axis
    var chart_xValue; // value for x axis selected from current data object (i.e. timestamp)
    var chart_xMap; // fn for x display value
    var chart_yScale;
    var chart_yAxis;
    var chart_yValue;
    var chart_yMap;
    //var chart_cValue; // value from current data point to determine color of circle (i.e. route_id)
    var chart_color; // color chosen for current circle on scatterplaot

    // time of day for scatterplot to start/end
    var CHART_START_TIME = 0; // start chart at midnight
    var CHART_END_TIME = 24; // end chart at midnight

    var CHART_DOT_RADIUS = 6; // size of dots on scatterplot

    // Erase of previous drawn chart
    chart_svg.selectAll("*").remove();

    /*
     * value accessor - returns the value to encode for a given data object.
     * scale - maps value to a visual display encoding, such as a pixel position.
     * map function - maps from data value to display value
     * axis - sets up axis
     */

    // *****************************************************
    // Here we define where to get X and Y values for chart
    // *****************************************************

    // For the X value, we derive a JS date from the acp_ts timestamp
    chart_xValue = function (d) {
        //DEBUG we should handle jsonpath_js in metadata
        var ts = jsonPath(d, feature_jsonpath_ts);
        return make_date(ts);
    }; // data -> value

    //DEBUG the location of the charted y value should be in metadata
    chart_yValue = function (d) {

        // Note jsonPath always returns a list of result, or false if path not found.
        let path_val = jsonPath(d, feature['jsonpath']); //d.payload_cooked.temperature;
        //console.log("chart_yValue path_val",d,path_val);
        if (path_val == false) {
            console.log("chart_yValue returning null")
            return null;
        }
        let y_val = path_val[0];
        if (y_val == false) {
            return 0;
        }
        if (y_val == true) {
            return 1;
        }
        return y_val;
    }; // data -> value

    // setup fill color for chart dots
    //chart_cValue = function(d) { return d.route_id; },
    chart_color = function (d) {
        if ('acp_event' in d) {
            return '#ffff88';
        }
        if (chart_yValue(d) == null) {
            return "#888888";
        }
        if (chart_yValue(d) > feature['range'][1]) {
            return 'red';
        }
        return 'green';
    };

    // **********************
    // setup x axis
    // **********************
    chart_xScale = d3.scaleTime().range([0, chart_width]); // value -> display

    var min_date = d3.min(readings, chart_xValue);
    min_date.setHours(CHART_START_TIME);
    min_date.setMinutes(0);
    min_date.setSeconds(0);

    var max_date = new Date(min_date);
    max_date.setHours(CHART_END_TIME);

    chart_xScale.domain([min_date, max_date]);

    var x_tick_count = CHART_END_TIME - CHART_START_TIME;
    if (chart_width < 600)
        x_tick_count = 12;

    chart_xAxis = d3.axisBottom().scale(chart_xScale).ticks(x_tick_count);
    //chart_svg.select(".x.axis").call(chart_xAxis);

    //make a chart_graph variable that had elements within the svg
    chart_graph= chart_svg.append("g").attr('id', "graph_elements").style('opacity',0);

    // x-axis
    chart_graph.append("g")
        .attr("class", "x axis")
        .attr('id', "axis--x")
        .attr("transform", "translate(0," + chart_height + ")")
        .call(chart_xAxis
            .tickSize(-chart_height, 0, 0)
            .tickFormat(d3.timeFormat("%H:%M")) // Default time scale format
        )
        .attr("class", "grid")
        .append("text")
        .attr("class", "axis_label")
        .attr("x", chart_width)
        .attr("y", 40)
        .style("text-anchor", "end")
        .text("Time of day");

    // **********************
    // setup y axis
    // **********************
    chart_yScale = d3.scaleLinear()
        .domain(feature['range'])
        .range([chart_height, 0]); // value -> display
    // chart_yScale.domain([0, d3.max(readings, chart_yValue)+1]);

    chart_yAxis = d3.axisLeft().scale(chart_yScale);

    // setup chart functions d -> x,y where d = the current reading
    chart_xMap = function (d) {
        return chart_xScale(chart_xValue(d));
    }; // data -> display

    chart_yMap = function (d) {
        return chart_yScale(Math.min(chart_yValue(d), feature['range'][1]));
    }; // data -> display

    // y-axis
    chart_graph.append("g")
        .attr("class", "y axis")
        .attr('id', "axis--y")
        .call(chart_yAxis
            .tickSize(-chart_width, 0, 0)
            //.tickFormat("")
        )
        .attr("class", "grid")
        .append("text")
        .attr("class", "axis_label")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(feature['name']);


    // *****************************************
    // set up zooming
    // *****************************************


    var brush = d3.brush().extent([
            [0, 0],
            [chart_width, chart_height]
        ]).on("end", brushended),
        idleTimeout,
        idleDelay = 350;

    // Add a clipPath: everything out of this area won't be drawn.
    var clip = chart_graph.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", chart_width)
        .attr("height", chart_height)
        .attr("x", 0)
        .attr("y", 0);

    // Append a layer for the clipPath to enable zoom interactions
    var scatter = chart_graph.append("g")
        .attr("id", "scatterplot")
        .attr("clip-path", "url(#clip)")
        .on("dblclick", function (d) {//on doubleclick reset the visualisation

            //redraw chart
            scatter.selectAll("*").remove();
            draw_chart(readings, feature);
            set_zoom_hint(true); // Update zoom hint to re-explain how to zoom.
        });

        scatter.append("g")
        .attr("class", "brush")
        .call(brush);

    function brushended() {

        let s = d3.event.selection;
        if (!s) {
            if (!idleTimeout) return idleTimeout = setTimeout(idled, idleDelay);
            chart_xScale.domain(d3.extent(readings, function (d) {
                return chart_xMap(d);
            }))
            chart_yScale.domain(d3.extent(readings, function (d) {
                return chart_yMap(d);
            }))
        } else {

            chart_xScale.domain([s[0][0], s[1][0]].map(chart_xScale.invert, chart_xScale));
            chart_yScale.domain([s[1][1], s[0][1]].map(chart_yScale.invert, chart_yScale));
            scatter.select(".brush").call(brush.move, null);
        }

        zoom();
        //make tooltip invisible
        d3.select('#tooltip_el').style('opacity', 0);

    }

    function idled() {
        idleTimeout = null;
    }

    //zoom and change axes
    function zoom() {

        set_zoom_hint(false); // hint how to zoom back out

        var t = scatter.transition().duration(750);
        chart_graph.select("#axis--x").transition(t).call(chart_xAxis);
        chart_graph.select("#axis--y").transition(t).call(chart_yAxis);
        chart_graph.selectAll('.dot').transition(t)
            .attr("r", CHART_DOT_RADIUS)
            .attr("cx", chart_xMap)
            .attr("cy", chart_yMap);

        //add interactivity for all data points (copied from below)
        d3.selectAll('.dot')
            .style('opacity', function (d) {
                //if out of the boundaing box, make the circle invisible
                if ((chart_xMap(d) < 0 || chart_xMap(d) > chart_width) || (chart_yMap(d) < 0 || chart_yMap(d) > chart_height)) {
                    return 0;
                } else return 1;
            })
            .on("click", function (d) {
                show_reading_popup(d);
            })
            .on("mouseover", function (d) {
                mouseover_interactions(d, feature);
            })
            .on("mouseout", function (d) {
                chart_tooltip_el.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    }

    // *****************************************
    // draw readings dots
    // *****************************************
    chart_graph.selectAll(".dot")
        .data(readings)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", CHART_DOT_RADIUS)
        .attr("cx", chart_xMap)
        .attr("cy", chart_yMap)
        .style("fill", function (d) {
            return chart_color(d);
        })
        .on("click", function (d) {
            show_reading_popup(d);
        })
        .on("mouseover", function (d) {
            mouseover_interactions(d, feature);
        })
        .on("mouseout", function (d) {
            chart_tooltip_el.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // *******************************
    // add text for latest datapoint
    // *******************************
    var p = readings[readings.length - 1];
    var tooltip_element =chart_graph.append("g").attr('id', 'tooltip_el').style('opacity',1);

    tooltip_element.append("rect")
        .attr('x', chart_xMap(p) + CHART_DOT_RADIUS + 4)
        .attr('y', chart_yMap(p) - 27)
        .attr('width', 140)
        .attr('height', 36)
        .attr('rx', 6)
        .attr('ry', 6)
        .style('fill', 'white')

    var p_time = make_date(p.acp_ts);
    var p_time_str = ' @ ' + ('0' + p_time.getHours()).slice(-2) + ':' + ('0' + p_time.getMinutes()).slice(-2);
    tooltip_element.append("text")
        .attr('x', chart_xMap(p))
        .attr('y', chart_yMap(p))
        .attr('dx', CHART_DOT_RADIUS + 10)
        .style('font-size', '22px')
        .style('fill', '#333')
        .text(jsonPath(p, feature['jsonpath']) + p_time_str);

        chart_graph.transition().duration(200).style('opacity',1)
    //---------------------------------------------------------------------------//
    //---------------------------------------------------------------------------//
    //---------------------------------------------------------------------------//
} // end draw_chart


//created a 'bag' function that has d3 interactivity for hover over circles
//I thought it was easier than having duplicated chunks of code
function mouseover_interactions(d, feature) {
    chart_tooltip_el.transition()
        .duration(500)
        .style("opacity", 0);
    chart_tooltip_el.transition()
        .duration(200)
        .style("opacity", .9);
    chart_tooltip_el.html(tooltip_html(d, feature))
        .style("left", (d3.event.pageX + 5) + "px")
        .style("top", (d3.event.pageY - 28) + "px");

        //heatmap is within try/catch since not all sensors have 8x8s
    try {
        draw_heatmap(d);
    } catch (error) {
        console.log('no elsys eye: ', error)
    }
}
//draw an 8x8 matrix for elsys-eye sensors
function draw_heatmap(d) {
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

    // set the dimensions and margins of the graph
    let tt_margin = {
            top: 15,
            right: 15,
            bottom: 15,
            left: 15
        },
        tt_width = 250 - tt_margin.left - tt_margin.right,
        tt_height = 250 - tt_margin.top - tt_margin.bottom;

    // append the svg object to the body of the page
    let tt_svg = d3.select('#chart_tooltip')
        .append("svg")
        .attr("width", tt_width + tt_margin.left + tt_margin.right)
        .attr("height", tt_height + tt_margin.top + tt_margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + tt_margin.left + "," + tt_margin.top + ")");

    // Labels of row and columns
    let myGroups = [0, 1, 2, 3, 4, 5, 6, 7]
    let myVars = [0, 1, 2, 3, 4, 5, 6, 7]

    // Build X scales and axis:
    let x = d3.scaleBand()
        .range([0, tt_width])
        .domain(myGroups)
        .padding(0.01);

    // tt_svg.append("g")
    //     .attr("transform", "translate(0," + tt_height + ")")
    //     .call(d3.axisBottom(x))

    // Build X scales and axis:
    let y = d3.scaleBand()
        .range([0, tt_height])
        .domain(myVars)
        .padding(0.01);

    // tt_svg.append("g")
    //     .call(d3.axisLeft(y));

    // Build color scale
    let myColor = d3.scaleSequential(d3.interpolateTurbo)
        .domain([-5, 35])

    tt_svg.selectAll()
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
            return myColor(d.value)
        });

    console.log('showing 8x8', grid_data)
}


// Create a plot TOOLTIP our of the point data
//debug write this tooltip_html() for acp_web
function tooltip_html(p, feature) {
    let str = '';
    let p_time = make_date(p.acp_ts);
    let p_time_str = ('0' + p_time.getHours()).slice(-2) + ':' +
                     ('0' + p_time.getMinutes()).slice(-2) + ':' +
                     ('0' + p_time.getSeconds()).slice(-2);
    let tz = p_time.toTimeString().match(/\((.+)\)/)[1];

    if (jsonPath(p, feature['jsonpath']) != false) {
        str += '<br/>'+feature['name'] + ':' + jsonPath(p, feature['jsonpath']);
    }

    str += '<br/>'+p_time_str + ' ' + tz;

    return str;
}

// ************************************************************************************
// ************** Date forwards / backwards function             *********************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n, feature_id) {
    let year, month, day;
    console.log('date_shift()');
    if (YYYY == '') {
        year = plot_date.slice(0, 4);
        month = plot_date.slice(5, 7);
        day = plot_date.slice(8, 10);
    } else {
        year = YYYY;
        month = MM;
        day = DD;
    }

    let new_date = new Date(year, month - 1, day); // as loaded in page template config_ values;

    new_date.setDate(new_date.getDate() + n);

    let new_year = new_date.getFullYear();
    let new_month = ("0" + (new_date.getMonth() + 1)).slice(-2);
    let new_day = ("0" + new_date.getDate()).slice(-2);

    console.log(new_year + '-' + new_month + '-' + new_day);
    window.location.href = '?date=' + new_year + '-' + new_month + '-' + new_day + '&feature=' + feature_id;
}

// Return a javascript Date, given EITHER a UTC timestamp or a ISO 8601 datetime string
function make_date(ts) {
    var t;

    var ts_float = parseFloat(ts);
    if (!Number.isNaN(ts)) {
        t = new Date(ts_float * 1000);
    } else {
        // replace anything but numbers by spaces
        var dt = ts.replace(/\D/g, " ");

        // trim any hanging white space
        dt = dt.replace(/\s+$/, "");

        // split on space
        var dtcomps = dt.split(" ");

        // modify month between 1 based ISO 8601 and zero based Date
        dtcomps[1]--;

        t = new Date(Date.UTC(dtcomps[0], dtcomps[1], dtcomps[2], dtcomps[3], dtcomps[4], dtcomps[5]));
    }
    return t;
}

// *****************************************************************************
// Display sensor reading when graph point is clicked
// *****************************************************************************
function init_reading_popup() {
    // Div, initially hidden, pops up to show full reading json
    reading_popup_el = document.getElementById('reading_popup');

    document.getElementById('reading_close').onclick = hide_reading_popup;

}

// show_reading_popup is called when a data point on the graph is clicked.
function show_reading_popup(d) {
    reading_popup_el.style.display = 'block';
    var content = document.getElementById("reading_content");
    content.innerHTML = JSON.stringify(d, null, 4);
}

function hide_reading_popup() {
    console.log("reading_popup hide")
    reading_popup_el.style.display = "none";
}

function update_url(feature, date) {
    var searchParams = new URLSearchParams(window.location.search)
    searchParams.set("feature", feature);
    searchParams.set("date", date);
    var newRelativePathQuery = window.location.pathname + '?' + searchParams.toString();
    history.pushState(null, '', newRelativePathQuery);
}

// Something has gone wrong, so give the user at least a clue
function report_error(error_id, error_msg) {
    console.log("reporting error", error_id, error_msg);
    document.getElementById('chart').textContent = error_msg;
}
