"use strict"
// uses API_READINGS, API_SENSORS, SENSOR_REALTIME set in template

function getSensor(){
    var source = document.getElementById("source").value
    const url = API_SENSORS + '?source='+source;

    var jsonData1 = $.ajax({
        url: url,
        dataType: 'json',
        xhrFields: {
          withCredentials: false
        },
        async: true,
        headers: {"Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                  "Access-Control-Allow-Headers": "x-requested-with"},
        crossDomain: true
      }).done(function (results) {
        var data=[];
        data.push('Select Sensor')
        results["data"].forEach(function(packet) {
          data.push(packet.sensor);
        });

        var opt = '';
        for (var i = 0; i < data.length; i++){
          console.log(data[i]);
          opt += '<option value= "' + data[i] + '">' + data[i] + '</option>';
        }
        $('#sensor').html(opt);

      });

  }

  function getFeature(){
    var date = document.getElementById("date").value
    var source = document.getElementById("source").value
    var sensor = document.getElementById("sensor").value
    const url = API_SENSORS + 'features/?&sensor='+sensor;

    var jsonData2 = $.ajax({
        url: url,
        dataType: 'json',
        xhrFields: {
          withCredentials: false
        },
        async: true,
        headers: {"Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                  "Access-Control-Allow-Headers": "x-requested-with"},
        crossDomain: true
      }).done(function (results) {
        var data=[];
        results["data"].forEach(function(packet) {
          data.push(packet.feature);
        });

        var opt = '';
        for (var i = 0; i < data.length; i++){
          console.log(data[i]);
          opt += '<option value= "' + data[i] + '">' + data[i] + '</option>';
        }
        $('#feature').html(opt);

      });

  }

  function chart_init() {

    $(document).ajaxStart(function() {
      $("#loading").show();
    }).ajaxStop(function() {
      $("#loading").hide();
    });

    var today = new Date().toISOString().split('T')[0];

    var form_date = document.getElementById("form_date");

    form_date.setAttribute('value', today);

    var contplot = true;
    var selecteddate = form_date.value;
    var source = document.getElementById("source").value;
    var sensor = document.getElementById("sensor").value;
    var feature = document.getElementById("feature").value;

    var url = API_READINGS + 'historicaldata?date=' + selecteddate
                           + '&source=' + source
                           + '&sensor=' + sensor
                           + '&feature=' + feature;

    if(selecteddate != today){
      contplot = false;
    }
    var jsonData = $.ajax({
      url: url,
      dataType: 'json',
      async: true,
      headers: {"Access-Control-Allow-Origin": "*"},
    }).done(function (results) {

      // Split timestamp and data into separate arrays
      var labels = [], data=[], rdate, rsensor, rfeature;
      rdate = results["date"];
      rsensor = results["sensor"];
      rfeature = results["feature"];
      results["data"].forEach(function(packet) {
        var date = new Date(parseFloat(packet.ts) * 1000);
        var hours = date.getHours();
        labels.push(hours)
        data.push(parseFloat(packet.val));
      });

      // // Get the context of the canvas element we want to select
      var ctx = document.getElementById("myChart");

      var updateButton = document.getElementById('updateButton');
      updateButton.addEventListener("click", function(){
        myNewChart.destroy();
      });

      // Create the chart.js data structure using 'labels' and 'data'
      var tempData = {
        labels : labels,
        datasets : [{
            fillColor             : "rgba(151,187,205,0.2)",
            strokeColor           : "rgba(151,187,205,1)",
            pointColor            : "rgba(151,187,205,1)",
            pointStrokeColor      : "#fff",
            pointHighlightFill    : "#fff",
            pointHighlightStroke  : "rgba(151,187,205,1)",
            data                  : data
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

      if (contplot){
        plotRealTime();
      }

      function plotRealTime(){
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
    });
  }
