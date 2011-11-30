/**
 * @author Artjom Kurapov
 * @since 15.03.11 0:24
 */

function Vector(x,y){
    A={};
    A.x=x;
    A.y=y;


    A.forceMultiplier=function(method, optimal_distance){
        if(method =='linear'){
            A.multiply( A.length() / optimal_distance); //0.01*100
        }
        /*
         else if(method=='square'){
         if(A.square()!=0)
         A.multiply(0.0001 * A.square()); //0.0001*100
         }
         else if(method =='log'){
         if(0.01*A.length()<1) return;//A.multiply(0);

         A.multiply(Math.log(0.01*A.length()));
         }
         */
        else if(method =='reverse_linear'){
            A.multiply(1 / (optimal_distance * (A.length()-optimal_distance)));
        }
        else if(method =='hyper'){
            if(A.square()!=0)
                A.multiply(optimal_distance / (A.length()));
        }
        /*
         else if(method =='periodic'){
         f = 0.01*A.length();
         f = Math.abs(Math.sin(f)*Math.pow(f,0.3));

         A.multiply(f);
         }
         */

    }

    A.reflectX = function (){
        this.x = -1*this.x;
    }
    A.reflectY = function (){
        this.y = -1*this.y;
    }

    A.length = function(force){
        if(A.l==null){
            A.l = Math.sqrt(A.square());
        }

        return A.l;
    }

    A.square = function(){
        if(A.s==null){
            A.s = this.x*this.x+this.y*this.y;
        }
        return A.s;
    }

    A.normalize = function(){
        len = A.length();
        if(len>0){
            A.x=A.x/len;
            A.y=A.y/len;
        }
    }

    A.isLonger = function(s){
        if(this.x*this.x+this.y*this.y > s*s) return true;
        else return false;
    }

    A.add = function(V){
        this.x = this.x + V.x;
        this.y = this.y + V.y;

        A.s = this.x*this.x+this.y*this.y;
        A.l = Math.sqrt(A.s);
    }

    A.multiply = function(a){
        this.x=a*this.x;
        this.y=a*this.y;

        A.s = this.x*this.x+this.y*this.y;
        A.l = Math.sqrt(A.s);
    }


    return A;

}