/**
 * @author Artjom Kurapov
 * @since 15.03.11 0:23
 */

/* Private classes */
function Node(ID, x, y, r, name) {
    this.ID = ID;

    if (graph.options.universe.limited) {
        if (x > graph.window_width) {
            x = graph.window_width;
        }
        if (x < 0) {
            x = 0
        }
        if (y > graph.window_height) {
            y = graph.window_height;
        }
        if (y < 0) {
            y = 0;
        }
    }

    this.x = x;
    this.y = y;
    this.mass = 1;
    this.energyGainStep = 0;

    this.name = name;
    this.r = r;
    this.img = null;
    /*
     this.dx = 0; //Math.ceil((Math.random()-0.5)*5);
     this.dy = 0; //Math.ceil((Math.random()-0.5)*5);
     */
    this.velocity = Vector(0, 0);
    this.acceleration = Vector(0, 0);


    //F=m*m*l
    //m2

    //transformCoordinates

    this.loadPhoto = function (src) {
        if (src == '') {
            return false;
        }
        var me = this;

        var img = new Image();
        img.onload = function () {
            me.img = img;
        };
        img.src = src;
    };

    this.move = function () {

        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;

        if (graph.options.universe.limited) {
            /*
             if(this.x > graph.window_width*graph.options.universe.viewpoint.zoom/2){
             this.x = graph.window_width*graph.options.universe.viewpoint.zoom/2;
             this.velocity.reflectX();
             }
             else if(this.x < -graph.window_width*graph.options.universe.viewpoint.zoom/2){
             this.x = -graph.window_width*graph.options.universe.viewpoint.zoom/2;
             this.velocity.reflectX();
             }

             if(this.y > graph.window_height*graph.options.universe.viewpoint.zoom/2){
             this.y = graph.window_height*graph.options.universe.viewpoint.zoom/2;
             this.velocity.reflectY();
             }
             else if(this.y < -graph.window_height*graph.options.universe.viewpoint.zoom/2){
             this.y = -graph.window_height*graph.options.universe.viewpoint.zoom/2;
             this.velocity.reflectY();
             }*/

            if (this.x * this.x + this.y * this.y > 20000000) {

                this.x = this.x - this.velocity.x;
                this.y = this.y - this.velocity.y;
                this.velocity.reflectY();
                this.velocity.reflectX();

                //this.velocity.multiply(0.5);
            }
        }


        //large nodes automatically move smallest connected particles with them
        /*
         if(graph.nodes[i].mass>1){
         for(j in connections[i]){
         if(graph.nodes[j].mass==1){
         graph.nodes[j].x = graph.nodes[j].x + this.velocity.x;
         graph.nodes[j].y = graph.nodes[j].y + this.velocity.y;
         }
         }
         }*/
    };

    this.draw = function () {
        graph.ctx.font = Math.round(graph.options.radius_ratio / graph.options.universe.viewpoint.zoom) + "pt Calibri";
        graph.ctx.beginPath();
        graph.ctx.font = graph.options.canvas.font;

        if (graph.selected_nodes == this.ID) {
            graph.ctx.fillStyle = graph.options.selected_node_color;
        }
        else {
            graph.ctx.fillStyle = "#000";
        }

        visible_radius = graph.options.radius_ratio * this.r /** Math.log(1+this.mass)*/ / graph.options.universe.viewpoint.zoom;

        if (this.img != null) {
            ctx.drawImage(this.img,
                (graph.options.universe.viewpoint.x + this.x) / graph.options.universe.viewpoint.zoom - visible_radius / 2,
                (graph.options.universe.viewpoint.y + this.y) / graph.options.universe.viewpoint.zoom - visible_radius / 2,
                visible_radius,
                visible_radius/*this.img.width,this.img.height*/);
            //ctx.globalCompositeOperation = "darker";
        }
        else if (graph.options.nodes.visible) {
            graph.ctx.arc(
                (graph.options.universe.viewpoint.x + this.x) / graph.options.universe.viewpoint.zoom,
                (graph.options.universe.viewpoint.y + this.y) / graph.options.universe.viewpoint.zoom,
                visible_radius / 2, 0, Math.PI * 2, true);
        }

        //if(this.name.length>0)
        if (graph.options.labels.visible) {
            x = (graph.options.universe.viewpoint.x + this.x) / graph.options.universe.viewpoint.zoom;
            y = ((graph.options.universe.viewpoint.y + this.y) / graph.options.universe.viewpoint.zoom);

            if (graph.options.nodes.visible) {
                //x = x - visible_radius / 2;
                y = y + visible_radius + 3;
            }
            aWidth = graph.ctx.measureText(this.name);
            graph.ctx.fillText(this.name, x - aWidth.width / 2, y);
        }

        graph.ctx.closePath();
        graph.ctx.fill();

    };

    this.drawConnections = function () {

        for (i in graph.connections[this.ID]) {
            dstNode = graph.nodes[i];
            if (typeof dstNode == 'undefined') {
                continue;
            }

            if (dstNode.mass >= graph.options.draw_with_min_mass && dstNode.mass <= this.mass) { //do not draw connections under certain mass
                weight = graph.connections[this.ID][i];
                if (!weight) {
                    weight = graph.options.connection_max_width;
                }

                if (graph.selected_nodes == this.ID || dstNode.ID == graph.selected_nodes) {
                    graph.ctx.strokeStyle = graph.options.selected_node_color;
                    graph.ctx.lineWidth = 1;
                }
                else {
                    graph.ctx.strokeStyle = graph.options.connection_color;
                    graph.ctx.lineWidth = graph.options.connection_min_width;
                }
                //ctx.fillStyle = "black";
                //				ctx.lineWidth = weight*graph.options.connection_max_width;
                //if(ctx.lineWidth<graph.options.connection_min_width)


                graph.ctx.beginPath();

                //ctx.strokeStyle = "#000";

                graph.ctx.moveTo(
                    (graph.options.universe.viewpoint.x + Math.round(this.x)) / graph.options.universe.viewpoint.zoom,
                    (graph.options.universe.viewpoint.y + Math.round(this.y)) / graph.options.universe.viewpoint.zoom
                );

                graph.ctx.lineTo(
                    (graph.options.universe.viewpoint.x + Math.round(dstNode.x)) / graph.options.universe.viewpoint.zoom,
                    (graph.options.universe.viewpoint.y + Math.round(dstNode.y)) / graph.options.universe.viewpoint.zoom
                );
                graph.ctx.stroke();
                graph.ctx.closePath();
            }
            //ctx.fill();
            //ctx.stroke();
        }

        graph.ctx.save();
    };

    this.getX = function () {
        return x;
    };

    this.getY = function () {
        return this.y;
    }

}