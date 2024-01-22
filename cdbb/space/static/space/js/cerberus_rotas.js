
// Select the SVG element
var svg = d3.select("#drawing_svg");

// Create a new image object
var img = new Image();

// Specify the src of the image
img.src = "http://adacity-jb.al.cl.cam.ac.uk/static_web/space/images/LT1_seating_uncompressed.png";  // Relative path from script.js to image.png
// space/images/floor_splash.png
// Function to execute once the image is loaded
img.onload = function() {
    // Get image dimensions
    var width = this.width;
    var height = this.height;


    d3.select("#main_drawing_div")
    .style("width", "100%")  // e.g., "500px" or "100%"
    .style("height", "100%"); // e.g., "300px" or "auto"
  

 // Set the image as the background of the div
//  d3.select("#main_drawing_div")
//  .style("background-image", "url(" + img.src + ")")
//  .style("background-size", "contain");


 d3.select("#main_drawing_div")
  .style("background-image", "url('http://adacity-jb.al.cl.cam.ac.uk/static_web/space/images/LT1_seating_uncompressed.png')")
  .style("background-size", "contain")
  .style("background-position", "center center")
  .style("background-repeat", "no-repeat")
  .style("width", "100%") // Adjust as needed
  .style("height", "100%"); // Adjust as needed

    // Add D3 code for drawing circles or other elements here
    // Example: svg.append("circle")...
};

