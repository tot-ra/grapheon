$(document).ready(function(){
	graph.addNode(first_root_domain,0,first_root_domain_name);
	getNodeConnections(first_root_domain);
	getIntervalConnections();

	stoppable_drawing = 0;
	
	setInterval(function(){
		iClustering = graph.getClusteringLevel().toFixed(2);
		if(iClustering< 1 * $('#clustering_level').html()) $('#clustering_level').css('color','red');
		if(iClustering > 1 * $('#clustering_level').html()) $('#clustering_level').css('color','green');
		$('#clustering_level').html(iClustering);
	},7000);
});


function getNodeConnections(sourceNodeID){
	$.getJSON(link_json_connections+'&sourceID='+sourceNodeID,function(responce){
		$.each(responce.out,function(i,potentialNode){
			graph.addNode(potentialNode.domainID,sourceNodeID,potentialNode.domain_name);
			graph.addConnection(sourceNodeID, potentialNode.domainID, potentialNode.weight);
			//graph.addConnection(potentialNode.domainID, sourceNodeID, potentialNode.weight);
		});

		$.each(responce['in'], function(i,potentialNode){
			graph.addNode(potentialNode.domainID,sourceNodeID,potentialNode.domain_name);
			graph.addConnection(potentialNode.domainID, sourceNodeID, potentialNode.weight);
			//graph.addConnection(sourceNodeID, potentialNode.domainID, potentialNode.weight);
		});

		setTimeout(getIntervalConnections, 3000);
	});
}

//gets next node and async's its connections
function getIntervalConnections(){
	ID = 1*graph.getNextQueueNode();

	if(ID>0){
		getNodeConnections(ID);
	}
}