"use strict";

//a class designated to handling dom manipulation using js functions.
//Currently primarily used for the sliding hamburger/navigation menu.
 class TemplateTools {
            constructor() {
                this.target = 'mySidenav';
                this.open_width='250px';
                this.close_width='0';
            }

            /* Set the width of the side navigation to 250px */
            openNav() {
                document.getElementById(this.target).style.width = this.open_width;
            }

            /* Set the width of the side navigation to 0 */
            closeNav() {
                document.getElementById(this.target).style.width = this.close_width;
            }

        }