"use strict"
// uses API_READINGS, API_SENSORS, SENSOR_REALTIME set in template

var loading_el; // loading element animated gif
var acp_id = "ijl20-sodaq-ttn";
var readings_date = new Date().toISOString().split('T')[0];
var readings_source = "mqtt_acp";
var readings_feature = "temperature";
var today = new Date().toISOString().split('T')[0];

// Called on page load
function chart_init() {
    loading_el = document.getElementById('loading');

   var form_date = document.getElementById("form_date");

   form_date.setAttribute('value', readings_date);

   var updateButton = document.getElementById('updateButton');
   updateButton.addEventListener("click", function(){
     myNewChart.destroy();
   });

   document.getElementById("feature").value = readings_feature;

   get_readings();
}

// Use API_READINGS to retrieve requested sensor readings
function get_readings() {
    var readings_url = API_READINGS + 'historicaldata/'
                        + '?sensor=' + acp_id
                        + '&date=' + readings_date
                        + '&source=' + readings_source
                        + '&feature=' + readings_feature;

    console.log("using readings URL: "+readings_url);

    var jsonData = $.ajax({
      url: readings_url,
      dataType: 'json',
      async: true,
      headers: {"Access-Control-Allow-Origin": "*"},
    }).done(handle_readings);
  }

function handle_readings(results) {

    console.log('handle_readings()');

    loading_el.className = 'loading_hide'; // set style "display: none"

    // Split timestamp and data into separate arrays
    var labels = [],
        readings=[],
        rdate = results["date"],
        rsensor = results["sensor"],
        rfeature = results["feature"];

    results["data"].forEach(function(packet) {
      var date = new Date(parseFloat(packet.ts) * 1000);
      var hours = date.getHours();
      labels.push(hours)
      readings.push(parseFloat(packet.val));
    });

    // // Get the context of the canvas element we want to select
    var ctx = document.getElementById("chart_canvas");

    // Create the chart.js data structure using 'labels' and 'readings'
    var tempData = {
      labels : labels,
      datasets : [{
          fillColor             : "rgba(151,187,205,0.2)",
          strokeColor           : "rgba(151,187,205,1)",
          pointColor            : "rgba(151,187,205,1)",
          pointStrokeColor      : "#fff",
          pointHighlightFill    : "#fff",
          pointHighlightStroke  : "rgba(151,187,205,1)",
          data                  : readings
      }]
    };

    var opts = {
      animation: false,
      title: {
        display: true,
        text: 'Date: ' + rdate+', Sensor: '+rsensor+', Feature: '+rfeature,
        fontSize: 15

      },
      fill: false,
      showLines: false,
      legend: {
        display: false
      },
      scales: {
        xAxes : [{
             gridLines : {
              display : false,
             },
             ticks: {
              autoSkip: true,
              maxTicksLimit: 20.1
             },
             scaleLabel: {
              display: true,
              labelString: 'Hour of the day',
              fontStyle: 'bold',
              fontSize: 13
             }
        }]
      }
    }

    // // // Instantiate a new chart
    var myNewChart = new Chart(ctx , {
      type: "line",
      data: tempData,
      options: opts
    });

    if(readings_date == today) {
        console.log("plot_realtime() will be called");
        //debug plot_realtime() disabled
        //plotRealTime();
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
