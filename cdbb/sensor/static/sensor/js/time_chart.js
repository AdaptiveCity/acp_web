"use strict"
// uses ACP_IP, API_READINGS, API_SENSORS, SENSOR_REALTIME set in template

//********************************************************************************
//***********  LOAD VARS FROM SERVER    ******************************************
//********************************************************************************

var feed_id = 'mqtt_acp'; //''{{config_feed_id}}';

var plot_date; // date of currently displayed plot (initialized from YYYY/MM/DD)

var plot_date_minus_1; // plot_date - 1 day
var plot_date_plus_1; // plot_date + 1 day

var month_of_year = new Array("spacer", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");
var day_of_week = new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

// d3 scatterplot parameters
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
var CHART_Y_MAX = 40; // FIX limit of Y axis

var feature_label = "Temperature (celcius)"; //DEBUG get from metadata

var loading_el; // loading element animated gif
var readings_source = "mqtt_acp";
var readings_feature = "temperature";
var today = new Date().toISOString().split('T')[0];

// Called on page load
function init() {
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

    loading_el = document.getElementById('loading');

    var form_date = document.getElementById("form_date");

    form_date.setAttribute('value', plot_date);

    var updateButton = document.getElementById('updateButton');
    updateButton.addEventListener("click", function(){
        myNewChart.destroy();
    });

    // test if YYYY/MM/DD is TODAY'S DATE
    //if (today.getFullYear()==YYYY && today.getMonth()==(MM-1) && today.getDate()==DD)
    //{
    //  console.log('plotting today - reloading in 6 minutes');
    //  setTimeout( function () { location.reload(); }, 6 * 60 * 1000 );
    //}

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

    var readings = results["readings"];

    var sensor_metadata = results["sensor_metadata"];

    loading_el.className = 'loading_hide'; // set style "display: none"

    update_select_area(sensor_metadata);

    draw_chart(readings, sensor_metadata);
}

// Populate the 'select' area at the top of the page using info from
// the sensor metadata, e.g. the list of 'features'.
function update_select_area(sensor_metadata) {
    var feature_select = document.getElementById("form_feature");
    var features = sensor_metadata["acp_type_info"]["features"];;
    for (const feature in features) {
        console.log("feature: "+feature);
        const option = document.createElement('option');
        const text = document.createTextNode(features[feature]["short_name"]);
        // set option text
        option.appendChild(text);
        // and option value
        option.setAttribute('value',feature);
        // add the option to the select box
        feature_select.appendChild(option);
    }
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
        myNewChart.update();
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
      var svg_width = document.getElementById("chart").clientWidth;
      var svg_height = document.getElementById("chart").clientHeight;

      // calculate the dimensions of the actual chart within the SVG area (i.e. allowing margins for axis info)
      var chart_width = svg_width - 210;
      var chart_height = svg_height - 110;
      var chart_offsetx = 60;
      var chart_offsety = 20;

    // add the graph canvas to the body of the webpage
    chart_svg = d3.select("#chart").append("svg")
        .attr("width", svg_width)
        .attr("height", svg_height)
        .attr("class", "plot_svg")
        .append("g")
        .attr("transform", "translate(" + chart_offsetx + "," + chart_offsety + ")");

    // setup x axis
    chart_xScale = d3.scaleTime().range([0, chart_width]); // value -> display

    var tick_count = 24;
    if (chart_width < 600)
        tick_count = 12;

    chart_xAxis = d3.axisBottom().scale(chart_xScale).ticks(tick_count);

    // setup y axis
    chart_yScale = d3.scaleLinear().range([chart_height, 0]); // value -> display
    chart_yAxis = d3.axisLeft().scale(chart_yScale).ticks(10);

    // setup chart functions where d = the zone transit record
    chart_xValue = function(d) { return make_date(d.acp_ts);}; // data -> value
    chart_xMap = function(d) { return chart_xScale(chart_xValue(d));}; // data -> display

    //DEBUG the location of the charted y value should be in metadata
    chart_yValue = function(d) { return d.payload_cooked.temperature; }, // data -> value
    chart_yMap = function(d) { return chart_yScale(Math.min(chart_yValue(d), CHART_Y_MAX));}; // data -> display

    // setup fill color
    //chart_cValue = function(d) { return d.route_id; },
    chart_color = function (d) {
        if (d.duration > CHART_Y_MAX)
        {
          return 'red';
        }
        return (d.route_id==null || d.route_id=="") ? 'green' : 'yellow';
    };

    // initialize x axis - will redraw when data received
    var min_date = new Date(YYYY,MM-1,DD);
    min_date.setHours(CHART_START_TIME);
    min_date.setMinutes(0);
    min_date.setSeconds(0);

    var max_date = new Date(min_date);
    max_date.setHours(CHART_END_TIME);

    chart_xScale.domain([min_date, max_date]);
    chart_yScale.domain([0, CHART_Y_MAX]);

    // x-axis
    chart_svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + chart_height + ")")
      .call(chart_xAxis
            .tickSize(-chart_height, 0, 0)
            .tickFormat(d3.timeFormat("%H"))
       )
      .attr("class", "grid")
      .append("text")
      .attr("class", "label")
      .attr("x", chart_width)
      .attr("y", 26)
      .style("text-anchor", "end")
      .text("Time of day");

    // y-axis
    chart_svg.append("g")
      .attr("class", "y axis")
      .call(chart_yAxis
            .tickSize(-chart_width, 0, 0)
            //.tickFormat("")
      )
      .attr("class", "grid")
      .append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text(feature_label);

    // add the tooltip area to the webpage
    chart_tooltip = d3.select("#chart").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

}

// ****************************************************************************
// *********  Update the chart with sensor readings data **********************
// ****************************************************************************
function draw_chart(readings, sensor_metadata)
{
    console.log('Drawing chart size='+readings.length, readings);

    // do nothing if no data is available
    if (readings.length == 0) return;

    /*
     * value accessor - returns the value to encode for a given data object.
     * scale - maps value to a visual display encoding, such as a pixel position.
     * map function - maps from data value to display value
     * axis - sets up axis
    */

      // don't want dots overlapping axis, so add in buffer to data domain
      var min_date = d3.min(readings, chart_xValue);
      min_date.setHours(CHART_START_TIME);
      min_date.setMinutes(0);
      min_date.setSeconds(0);

      var max_date = new Date(min_date);
      max_date.setHours(CHART_END_TIME);

      chart_xScale.domain([min_date, max_date]);
      // chart_yScale.domain([0, d3.max(readings, chart_yValue)+1]);
      //DEBUG y-scale hardcoded to CHART_Y_MAX so charts are comparable
      chart_yScale.domain([0, CHART_Y_MAX]);

      chart_svg.select(".x.axis").call(chart_xAxis);
      chart_svg.select(".y.axis").call(chart_yAxis);

      chart_svg.selectAll(".dot")
          .remove();

      // draw dots
      chart_svg.selectAll(".dot")
          .data(readings)
          .enter().append("circle")
          .attr("class", "dot")
          .attr("r", CHART_DOT_RADIUS)
          .attr("cx", chart_xMap)
          .attr("cy", chart_yMap)
          .style("fill", function(d) { return chart_color(d); })
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
          .text(p.payload_cooked.temperature + p_time_str);

} // end draw_chart

 // Create a plot TOOLTIP our of the point data
//debug write this tooltip_html() for acp_web
function tooltip_html(p)
{
    var str = 'DEBUG';
    //DEBUG this property should be configurable
    if (p.payload_cooked.temperature) {
      str += '<br/>Temperature:'+p.payload_cooked.temperature.toFixed(1);
    }
    str += '<br/>Time:' + make_date(p.acp_ts);
    if (p.journey) //debug get tooltip value from data
    {
        str += '<br/>'+JSON.stringify(d.journey).replace(/,/g,', ');
    }
    if (p.route_id)
    {
        str += '<br/>Route: '+p.route_id; // only if from GTFS feedhandler
    }
    return str;
}

// ************************************************************************************
// ************** Date forwards / backwards function             *********************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n)
{
    console.log('date_shift()');

    let new_date = new Date(YYYY,MM-1,DD); // as loaded in page template config_ values;

    new_date.setDate(new_date.getDate()+n);

    let new_year = new_date.getFullYear();
    let new_month = ("0" + (new_date.getMonth()+1)).slice(-2);
    let new_day = ("0" + new_date.getDate()).slice(-2);

    console.log(new_year+'-'+new_month+'-'+new_day);
    window.location.href = '?date='+new_year+'-'+new_month+'-'+new_day+'&metadata=true';
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
