"use strict"
// uses ACP_IP, API_READINGS, SENSOR_REALTIME set in template

// This codes requests a DAY sensor READINGS, with "&metadata=true" appended to
// the readings api url, so a json object { readings: [...], sensor_metadata: { } } is
// returned. The metadata defines each of the 'features' (e.g. temperature) available
// in the returned readings. Consequently this code does not need to call the
// sensors api separately (which the readings api will do server-side anyway)

var plot_date; // date of currently displayed plot (initialized from YYYY/MM/DD)

var month_of_year = new Array("spacer", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");
var day_of_week = new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

// d3 scatterplot parameters
var svg_width;
var svg_height;

// calculate the dimensions of the actual chart within the SVG area (i.e. allowing margins for axis info)
var chart_width;
var chart_height;
var chart_offsetx;
var chart_offsety;
var chart_svg;    // chart svg element
var chart_xScale; // d3 scale fn for x axis
var chart_xAxis;  // x axis
var chart_xValue; // value for x axis selected from current data object (i.e. timestamp)
var chart_xMap;   // fn for x display value
var chart_yScale;
var chart_yAxis;
var chart_yValue;
var chart_yMap;
//var chart_cValue; // value from current data point to determine color of circle (i.e. route_id)
var chart_color;  // color chosen for current circle on scatterplaot
var chart_tooltip;

// time of day for scatterplot to start/end
var CHART_START_TIME = 0; // start chart at midnight
var CHART_END_TIME = 24;  // end chart at midnight

var CHART_DOT_RADIUS = 6; // size of dots on scatterplot

var readings; // holds readings returned by API call
var sensor_metadata; // holds sensor metadata returned by API call

// from sensor_metadata
var feature_id;          // temperature
var feature_short_name;  // temp
var feature_long_name;   // temperature
var feature_jsonpath;    // $.payload_cooked.temperature
var feature_jsonpath_ts = '$.acp_ts'; // timestamp
var feature_range;       // [0,40]

var loading_el; // loading element animated gif
var reading_popup_el; // div to display full reading json
var feature_select_el; // feature select element

// Called on page load
function init() {

    // Set plot_date to today, or date given in URL (& parsed into template)
    if (YYYY=='') {
        plot_date = new Date().toISOString().split('T')[0];
    }
    else {
        plot_date = YYYY+'-'+MM+'-'+DD;
    }

    // set up onclick calls for day/week forwards/back buttons
    document.getElementById("back_1_week").onclick = function () { date_shift(-7) };
    document.getElementById("back_1_day").onclick = function () { date_shift(-1) };
    document.getElementById("forward_1_week").onclick = function () { date_shift(7) };
    document.getElementById("forward_1_day").onclick = function () { date_shift(1) };

    // Animated "loading" gif, shows until readings are loaded from api
    loading_el = document.getElementById('loading');

    feature_select_el = document.getElementById("form_feature");

    // The cool date picker
    var form_date = document.getElementById("form_date");

    form_date.setAttribute('value', plot_date);

    init_reading_popup();

    // set up layout / axes of scatterplot
    init_chart();

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

// API http call has returned these results { readings: ..., sensor_metadata: ...}
function handle_readings(results) {
    console.log('handle_readings()', results);

    readings = results["readings"];

    sensor_metadata = results["sensor_metadata"];

    loading_el.className = 'loading_hide'; // set style "display: none"

    handle_sensor_metadata(sensor_metadata);

    // Setup onchange callbacks to update chart on feature or date changes
    init_feature_select();

    draw_chart();
}

// Populate the 'select' area at the top of the page using info from
// the sensor metadata, e.g. the list of 'features'.
function handle_sensor_metadata(sensor_metadata) {
    var features = sensor_metadata["acp_type_info"]["features"];

    // ***************************************
    // Update selection dropdown on page
    // ***************************************
    // remove any initial entries
    while (feature_select_el.firstChild) {
        feature_select_el.removeChild(feature_select_el.firstChild)
    }

    let feature_count = 0;
    // add a select option for each feature in the sensor metadata
    for (const feature in features) {
        console.log("feature: "+feature);
        feature_count += 1;
        const option = document.createElement('option');
        const text = document.createTextNode(features[feature]["short_name"]);
        // set option text
        option.appendChild(text);
        // and option value
        option.setAttribute('value',feature);
        // add the option to the select box
        feature_select_el.appendChild(option);
    }

    if (feature_count == 0) {
        console.log("No features listed in sensor_metadata");
    }
    else if (FEATURE == '') {
        console.log("No feature given in page request");
        for (const feature in features) {
            console.log("Defaulting to feature "+feature);
            feature_id = feature;
            feature_short_name = features[feature_id]['short_name'];
            feature_long_name = features[feature_id]['long_name'];
            feature_jsonpath = features[feature_id]['jsonpath'];
            feature_range = features[feature_id]['range'];
            break;
        }
    }
    else {
        feature_id = FEATURE;
        feature_short_name = features[feature_id]['short_name'];
        feature_long_name = features[feature_id]['long_name'];
        feature_jsonpath = features[feature_id]['jsonpath'];
        feature_range = features[feature_id]['range'];
    }
}

function init_feature_select() {
    console.log("init_select_changes()");
    feature_select_el.value = feature_id;
    feature_select_el.onchange = onchange_feature_select;
}

function onchange_feature_select() {
    console.log("onchange_feature_select",window.location.href);
    var features = sensor_metadata["acp_type_info"]["features"];
    feature_id = feature_select_el.value;
    feature_short_name = features[feature_id]['short_name'];
    feature_long_name = features[feature_id]['long_name'];
    feature_jsonpath = features[feature_id]['jsonpath'];
    feature_range = features[feature_id]['range'];
    update_url(feature_id,plot_date);
    draw_chart();
}
// Subscribe to RTMonitor to receive incremental data points and update chart
function plot_realtime() {
    var client_data = {};
    var VERSION = 1;
    client_data.rt_client_id = 'unknown';
    client_data.rt_token = 'unknown';
    client_data.rt_client_name = 'rtmonitor_api.js V'+VERSION;

    var URL = SENSOR_REALTIME;

    var sock = new SockJS(URL);

    sock.onopen = function() {
      console.log('open');
      var msg_obj = { msg_type: 'rt_connect',
                      client_data: self.client_data
                  };

      sock.send(JSON.stringify(msg_obj));
    };

    sock.onmessage = function(e) {
      console.log('message', e.data);
      var msg = JSON.parse(e.data);
      if (msg.msg_type != null && msg.msg_type == "rt_nok"){
          console.log('Error',e.data);
      }
      if (msg.msg_type != null && msg.msg_type == "rt_connect_ok"){
          console.log("Connected")
          var msg_obj = {
              msg_type: "rt_subscribe",
              request_id: "A",
              filters: [
                  {
                      test: "=",
                      key: "acp_id",
                      value: "csn-node-test"
                  }
              ]
          }
          sock.send(JSON.stringify(msg_obj))
      }
      if (msg.msg_type != null && msg.msg_type == "rt_data"){
        console.log('Other',e.data)
        //var sData = getAptData();
        sData = msg.request_data[0].weight;
        console.log("sData:",sData);
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
function init_chart()
{
    // get the height and width of the "chart" div, and set d3 svg element to that
    svg_width = document.getElementById("chart").clientWidth;
    svg_height = document.getElementById("chart").clientHeight;

    // calculate the dimensions of the actual chart within the SVG area (i.e. allowing margins for axis info)
    chart_width = svg_width - 210;
    chart_height = svg_height - 110;
    chart_offsetx = 60;
    chart_offsety = 20;

    // add the graph canvas to the body of the webpage
    chart_svg = d3.select("#chart").append("svg")
        .attr("width", svg_width)
        .attr("height", svg_height)
        .attr("class", "plot_svg")
        .append("g")
        .attr("transform", "translate(" + chart_offsetx + "," + chart_offsety + ")");

    // add the tooltip area to the webpage
    chart_tooltip = d3.select("#chart").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

}

// ****************************************************************************
// *********  Update the chart with sensor readings data **********************
// ****************************************************************************
function draw_chart()
{
    console.log('Drawing chart size='+readings.length, readings);

    // do nothing if no data is available
    if (readings.length == 0) return;

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
    chart_xValue = function(d) {
        var ts = jsonPath(d, feature_jsonpath_ts);
        return make_date(ts);
    }; // data -> value

    //DEBUG the location of the charted y value should be in metadata
    chart_yValue = function(d) {
        let y_val = jsonPath(d, feature_jsonpath); //d.payload_cooked.temperature;
        //console.log("chart_yValue",d,y_val);
        if (y_val == false) {
            console.log("chart_yValue returning null")
            return null;
        } else {
            return y_val;
        }

    }; // data -> value

    // setup fill color for chart dots
    //chart_cValue = function(d) { return d.route_id; },
    chart_color = function (d) {
        if (chart_yValue(d) == null) {
            return "yellow";
        }
        if (chart_yValue(d) > feature_range[1])
        {
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

    // x-axis
    chart_svg.append("g")
    //.attr("class", "x axis")
    .attr("transform", "translate(0," + chart_height + ")")
    .call(chart_xAxis
          .tickSize(-chart_height, 0, 0)
          .tickFormat(d3.timeFormat("%H"))
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
                        .domain(feature_range)
                        .range([chart_height, 0]); // value -> display
    // chart_yScale.domain([0, d3.max(readings, chart_yValue)+1]);

    chart_yAxis = d3.axisLeft().scale(chart_yScale);

    // setup chart functions d -> x,y where d = the current reading
    chart_xMap = function(d) { return chart_xScale(chart_xValue(d));}; // data -> display

    chart_yMap = function(d) { return chart_yScale(Math.min(chart_yValue(d), feature_range[1]));}; // data -> display

    // y-axis
    chart_svg.append("g")
    .attr("class", "y axis")
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
    .text(feature_long_name);

    // *****************************************
    // draw readings dots
    // *****************************************
    chart_svg.selectAll(".dot")
      .data(readings)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("r", CHART_DOT_RADIUS)
      .attr("cx", chart_xMap)
      .attr("cy", chart_yMap)
      .style("fill", function(d) { return chart_color(d); })
      .on("click", function(d) {
          show_reading_popup(d);
      })
      .on("mouseover", function(d) {
          chart_tooltip.transition()
               .duration(500)
               .style("opacity", 0);
          chart_tooltip.transition()
               .duration(200)
               .style("opacity", .9);
          chart_tooltip.html(tooltip_html(d))
               .style("left", (d3.event.pageX + 5) + "px")
               .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", function(d) {
          chart_tooltip.transition()
               .duration(500)
               .style("opacity", 0);
      });

    // *******************************
    // add text for latest datapoint
    // *******************************
    var p = readings[readings.length - 1];

    chart_svg.append("svg:rect")
      .attr('x', chart_xMap(p)+CHART_DOT_RADIUS+4)
      .attr('y', chart_yMap(p)-27)
      .attr('width', 140)
      .attr('height', 36)
      .attr('rx', 6)
      .attr('ry', 6)
      .style('fill', 'white')

    var p_time = make_date(p.acp_ts);
    var p_time_str = ' @ '+('0'+p_time.getHours()).slice(-2)+':'+('0'+p_time.getMinutes()).slice(-2);
    chart_svg.append("svg:text")
      .attr('x', chart_xMap(p))
      .attr('y', chart_yMap(p))
      .attr('dx', CHART_DOT_RADIUS+10)
      .style('font-size', '22px')
      .style('fill', '#333')
      //DEBUG property name for chart should be in config metadata
      .text(jsonPath(p,feature_jsonpath) + p_time_str); //p.payload_cooked.temperature + p_time_str);

} // end draw_chart

 // Create a plot TOOLTIP our of the point data
//debug write this tooltip_html() for acp_web
function tooltip_html(p)
{
    var str = '';
    //DEBUG this property should be configurable
    if (jsonPath(p,feature_jsonpath) != false) { //p.payload_cooked.temperature) {
      str += '<br/>'+feature_long_name+':'+jsonPath(p, feature_jsonpath); //p.payload_cooked.temperature.toFixed(1);
    }
    str += '<br/>Time:' + make_date(p.acp_ts);
    return str;
}

// ************************************************************************************
// ************** Date forwards / backwards function             *********************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n)
{
    let year, month, day;
    console.log('date_shift()');
    if (YYYY == '') {
        year = plot_date.slice(0,4);
        month = plot_date.slice(5,7);
        day = plot_date.slice(8,10);
    } else {
        year = YYYY;
        month = MM;
        day = DD;
    }

    let new_date = new Date(year,month-1,day); // as loaded in page template config_ values;

    new_date.setDate(new_date.getDate()+n);

    let new_year = new_date.getFullYear();
    let new_month = ("0" + (new_date.getMonth()+1)).slice(-2);
    let new_day = ("0" + new_date.getDate()).slice(-2);

    console.log(new_year+'-'+new_month+'-'+new_day);
    window.location.href = '?date='+new_year+'-'+new_month+'-'+new_day+'&feature='+feature_id;
}

// Return a javascript Date, given EITHER a UTC timestamp or a ISO 8601 datetime string
function make_date(ts)
{
    var t;

    var ts_float = parseFloat(ts);
    if (!Number.isNaN(ts))
    {
        t = new Date(ts_float*1000);
    }
    else
    {
        // replace anything but numbers by spaces
        var dt = ts.replace(/\D/g," ");

        // trim any hanging white space
        dt = dt.replace(/\s+$/,"");

        // split on space
        var dtcomps = dt.split(" ");

        // modify month between 1 based ISO 8601 and zero based Date
        dtcomps[1]--;

        t = new Date(Date.UTC(dtcomps[0],dtcomps[1],dtcomps[2],dtcomps[3],dtcomps[4],dtcomps[5]));
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
    content.innerHTML = JSON.stringify(d,null,4);
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
