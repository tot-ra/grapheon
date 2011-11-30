/**
 * @author Artjom Kurapov
 * @since 01.03.11 22:56
 */

$(document).ready(function(){
	//graph.addNode(8602462,0,'tot_ra');
	//getNodeConnections(8602462);
	askCrawledNode();

	stoppable_drawing = 0;

	setInterval(function(){
		iClustering = graph.getClusteringLevel().toFixed(2);
		if(iClustering< 1 * $('#clustering_level').html()) $('#clustering_level').css('color','red');
		if(iClustering > 1 * $('#clustering_level').html()) $('#clustering_level').css('color','green');
		$('#clustering_level').html(iClustering);
	},7000);
});

/**
 * Crawl twitter
 */
function crawlNode(){
    $.getJSON(sys_url+'call/category/crawl_node_read/',function(cached_node_response){
        sourceNodeID = cached_node_response.id;

        $.ajax({
            'dataType':'jsonp',
            'url': 'http://api.twitter.com/1/users/show/'+sourceNodeID+'.json',
            'success' :function(twitter_node_response){
                $.post(sys_url+'call/category/crawl_node_write/?user_id='+sourceNodeID,twitter_node_response,function(){

                    //Dont ask for connections if he is not from around here
                    if(twitter_node_response.location.match(/Estonia/i)!=null || twitter_node_response.location.match(/Tallinn/i)!=null){
                        $.ajax({
                                'async':false,
                                'dataType':'jsonp',
                                'url': 'http://api.twitter.com/1/friends/ids.json?user_id='+sourceNodeID+'&cursor=-1',
                                'success':function(twitter_connection_response){
                                    $.post(sys_url+'call/category/crawl_connection_write/?user_id='+sourceNodeID,twitter_connection_response);
                                    //addGraphData(sourceNodeID,twitter_connection_response);
                                }
                            });
                    }
                });
            }
        });

    });
}

setInterval(crawlNode, 15000);


/**
 * Draw crawled data
 * Note that we have added all outgoing node connections during crawling, but we haven't checked those new nodes for their location, so instead we now
 * add all incoming connections
 */

var iLastNodeIterationAsked = 0;


function askCrawledNode(){
    //read active node data
     $.getJSON(sys_url+'call/category/tag_node_read/?increment_nr='+iLastNodeIterationAsked,function(response_node){
         if(response_node.id){
             crawledNodeID = response_node.id;
             

             $.getJSON(sys_url+'call/category/tag_connection_read/?user_id='+crawledNodeID+'&increment_nr='+iLastNodeIterationAsked,function(response_connection){
                 parentID=0;
                 if(typeof(response_connection.ids)!='undefined'){
                     parentID=response_connection.ids[0];
                 }
                 graph.addNode(response_node.id,parentID,response_node.name); //sourceNodeID
                 graph.nodes[response_node.id].loadPhoto(response_node.photo);

                 if(typeof(response_connection.ids)!='undefined'){
                     $.each(response_connection.ids,function(i,potentialNode){
                        graph.addConnection(potentialNode,crawledNodeID, 1); //,i/Connections.ids.length
                    });
                 }

                 iLastNodeIterationAsked=response_node.increment_nr;
             });
         }
     });

    setTimeout(askCrawledNode, 500);
}