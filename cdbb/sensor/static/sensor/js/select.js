"use strict"

function select_init() {

   var today = new Date().toISOString().split('T')[0];

   var form_date = document.getElementById("form_date");

   form_date.setAttribute('value', today);

   var updateButton = document.getElementById('updateButton');
   updateButton.addEventListener("click", function(){
        //debug
        console.log("Display sensor page");
   });

   var selected_date = form_date.value;
   var source = document.getElementById("source").value;
   var sensor = document.getElementById("sensor").value;
   var feature = document.getElementById("feature").value;
}

function get_sensor_list_from_source() {
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

  function getFeature() {
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
