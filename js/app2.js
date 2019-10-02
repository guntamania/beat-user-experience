import * as THREE from '../build/three.module.js';
import { OrbitControls } from '../jsm/controls/OrbitControls.js';
import { ConvexObjectBreaker } from '../jsm/misc/ConvexObjectBreaker.js';
import { ConvexBufferGeometry } from '../jsm/geometries/ConvexGeometry.js';
import { GeometryUtils } from '../jsm/utils/GeometryUtils.js';
import { OBJLoader } from '../jsm/loaders/OBJLoader.js';    
// - Global variables -
// Graphics variables
var camera, controls, scene, renderer;
var textureLoader;
var clock = new THREE.Clock();
var mouseCoords = new THREE.Vector2();
var raycaster = new THREE.Raycaster();
var ballMaterial = new THREE.MeshPhongMaterial( { color: 0x202020 } );
// Physics variables
var gravityConstant = 7.8;
var collisionConfiguration;
var dispatcher;
var broadphase;
var solver;
var physicsWorld;
var margin = 0.05;
var convexBreaker = new ConvexObjectBreaker();
// Rigid bodies include all movable objects
var rigidBodies = [];
var pos = new THREE.Vector3();
var quat = new THREE.Quaternion();
var transformAux1;
var tempBtVec3_1;
var objectsToRemove = [];
for ( var i = 0; i < 500; i ++ ) {
	objectsToRemove[ i ] = null;
}
var numObjectsToRemove = 0;
var impactPoint = new THREE.Vector3();
var impactNormal = new THREE.Vector3();
// - Main code -
Ammo().then( function ( AmmoLib ) {
	Ammo = AmmoLib;
	init();
	animate();
} );
// - Functions -
function init() {
	initGraphics();
	initPhysics();
	createObjects();
	initInput();
}
function initGraphics() {
    const container = document.getElementById('content');
	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );
	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xbfd1e5 );
	camera.position.set( - 14, 8, 16 );
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	container.appendChild( renderer.domElement );
	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 2, 0 );
	controls.update();
	textureLoader = new THREE.TextureLoader();
	var ambientLight = new THREE.AmbientLight( 0x707070 );
	scene.add( ambientLight );
	var light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set( - 10, 18, 5 );
	light.castShadow = true;
	var d = 14;
	light.shadow.camera.left = - d;
	light.shadow.camera.right = d;
	light.shadow.camera.top = d;
	light.shadow.camera.bottom = - d;
	light.shadow.camera.near = 2;
	light.shadow.camera.far = 50;
	light.shadow.mapSize.x = 1024;
	light.shadow.mapSize.y = 1024;
	scene.add( light );
	//
	window.addEventListener( 'resize', onWindowResize, false );
}
function initPhysics() {
	// Physics configuration
	collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
	dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
	broadphase = new Ammo.btDbvtBroadphase();
	solver = new Ammo.btSequentialImpulseConstraintSolver();
	physicsWorld = new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration );
	physicsWorld.setGravity( new Ammo.btVector3( 0, - gravityConstant, 0 ) );
	transformAux1 = new Ammo.btTransform();
	tempBtVec3_1 = new Ammo.btVector3( 0, 0, 0 );
}
function createObject( mass, halfExtents, pos, quat, material ) {
	var object = new THREE.Mesh( new THREE.BoxBufferGeometry( halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2 ), material );
	object.position.copy( pos );
	object.quaternion.copy( quat );
	convexBreaker.prepareBreakableObject( object, mass, new THREE.Vector3(), new THREE.Vector3(), true );
	createDebrisFromBreakableObject( object );
}
function createObjects() {
	// Ground
	pos.set( 0, - 0.5, 0 );
	quat.set( 0, 0, 0, 1 );
	var ground = createParalellepipedWithPhysics( 40, 1, 40, 0, pos, quat, new THREE.MeshPhongMaterial( { color: 0xFFFFFF } ) );
	ground.receiveShadow = true;
	textureLoader.load( "../texture/uxiketeru.png", function ( texture ) {
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 2, 2 );
		ground.material.map = texture;
		ground.material.needsUpdate = true;
	} );
    setInterval(()=> {
            createHuman();
    }, 3000);

    createHuman();
}

function createHuman() {
        // human
    var loader = new OBJLoader( new THREE.LoadingManager( () => {
        // onLoad
    } ) );
	loader.load( '../models/male02/male02.obj', ( obj ) => {
        obj.applyMatrix((new THREE.Matrix4()).makeScale(0.02, 0.02, 0.02));
        obj.position.y = -95;
        obj.castShadow = true;
	    obj.receiveShadow = true;
	    quat.set( 0, 0, 0, 1 );
        let shape = new Ammo.btBoxShape( new Ammo.btVector3( 1 * 0.5, 1 * 0.5, 1 * 0.5 ) );
        let position = new THREE.Vector3(5*(Math.random() - 0.5), -0.5, 5*(Math.random() - 0.5));
        let human = obj.clone();
        //human.position.y = -95;
        human.castShadow = true;
	    human.receiveShadow = true;
        // human.geometry.computeBoundingBox();
        // let bb = human.geometry.boundingBox.clone();
        createRigidBody( human, shape, 20, position, quat );
	}, 	(xhr) => {
        if ( xhr.lengthComputable ) {
			let percentComplete = xhr.loaded / xhr.total * 100;
			console.log( 'model ' + Math.round( percentComplete, 2 ) + '% downloaded' );
		}
    }, () => {
        // onError
    } );
}

function createParalellepipedWithPhysics( sx, sy, sz, mass, pos, quat, material ) {
	var object = new THREE.Mesh( new THREE.BoxBufferGeometry( sx, sy, sz, 1, 1, 1 ), material );
	var shape = new Ammo.btBoxShape( new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
	shape.setMargin( margin );
	createRigidBody( object, shape, mass, pos, quat );
	return object;
}
function createDebrisFromBreakableObject( object ) {
	object.castShadow = true;
	object.receiveShadow = true;
	var shape = createConvexHullPhysicsShape( object.geometry.attributes.position.array );
	shape.setMargin( margin );
	var body = createRigidBody( object, shape, object.userData.mass, null, null, object.userData.velocity, object.userData.angularVelocity );
	// Set pointer back to the three object only in the debris objects
	var btVecUserData = new Ammo.btVector3( 0, 0, 0 );
	btVecUserData.threeObject = object;
	body.setUserPointer( btVecUserData );
}
function removeDebris( object ) {
	scene.remove( object );
	physicsWorld.removeRigidBody( object.userData.physicsBody );
}
function createConvexHullPhysicsShape( coords ) {
	var shape = new Ammo.btConvexHullShape();
	for ( var i = 0, il = coords.length; i < il; i += 3 ) {
		tempBtVec3_1.setValue( coords[ i ], coords[ i + 1 ], coords[ i + 2 ] );
		var lastOne = ( i >= ( il - 3 ) );
		shape.addPoint( tempBtVec3_1, lastOne );
	}
	return shape;
}
function createRigidBody( object, physicsShape, mass, pos, quat, vel, angVel ) {
	if ( pos ) {
		object.position.copy( pos );
	} else {
		pos = object.position;
	}
	if ( quat ) {
		object.quaternion.copy( quat );
	} else {
		quat = object.quaternion;
	}
	var transform = new Ammo.btTransform();
	transform.setIdentity();
	transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
	transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
	var motionState = new Ammo.btDefaultMotionState( transform );
	var localInertia = new Ammo.btVector3( 0, 0, 0 );
	physicsShape.calculateLocalInertia( mass, localInertia );
	var rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
	var body = new Ammo.btRigidBody( rbInfo );
	body.setFriction( 0.5 );
	if ( vel ) {
		body.setLinearVelocity( new Ammo.btVector3( vel.x, vel.y, vel.z ) );
	}
	if ( angVel ) {
		body.setAngularVelocity( new Ammo.btVector3( angVel.x, angVel.y, angVel.z ) );
	}
	object.userData.physicsBody = body;
	object.userData.collided = false;
    object.castShadow = true;
	scene.add( object );
	if ( mass > 0 ) {
		rigidBodies.push( object );
		// Disable deactivation
		body.setActivationState( 4 );
	}
	physicsWorld.addRigidBody( body );
	return body;
}

function initInput() {
	window.addEventListener( 'mousedown', function ( event ) {
		mouseCoords.set(
			( event.clientX / window.innerWidth ) * 2 - 1,
			- ( event.clientY / window.innerHeight ) * 2 + 1
		);
		raycaster.setFromCamera( mouseCoords, camera );
		// Creates a ball and throws it
		const ballMass = 35;
		const ballRadius = 0.4;
        const loader = new THREE.FontLoader();
        const fontObj = {
            text: "UX",
		    height: 0.2,
		    size: 0.7,
		    hover: 0,
		    curveSegments: 0.4,
		    bevelThickness: 0.1,
		    bevelSize: 1.5,
		    bevelEnabled: false,
		    font: undefined,
		    fontName: "droid sans", // helvetiker, optimer, gentilis, droid sans, droid serif
		    fntWeight: "bold" // normal bold
        };
        loader.load( 'fonts/droid/droid_sans_bold.typeface.json',  ( response ) => {
		    fontObj.font = response;
            let ball = createTextMesh(fontObj);
		    ball.castShadow = true;
		    ball.receiveShadow = true;
		    var ballShape = new Ammo.btSphereShape( ballRadius );
		    ballShape.setMargin( margin );
		    pos.copy( raycaster.ray.direction );
		    pos.add( raycaster.ray.origin );
		    quat.set( 0, 0, 0, 1 );
		    var ballBody = createRigidBody( ball, ballShape, ballMass, pos, quat );
		    pos.copy( raycaster.ray.direction );
		    pos.multiplyScalar( 24 );
		    ballBody.setLinearVelocity( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
	    } );
	}, false );
}
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}
function animate() {
	requestAnimationFrame( animate );
	render();
}
function render() {
	var deltaTime = clock.getDelta();
	updatePhysics( deltaTime );
	renderer.render( scene, camera );
}
function updatePhysics( deltaTime ) {
	// Step world
	physicsWorld.stepSimulation( deltaTime, 10 );
	// Update rigid bodies
	for ( var i = 0, il = rigidBodies.length; i < il; i ++ ) {
		var objThree = rigidBodies[ i ];
		var objPhys = objThree.userData.physicsBody;
		var ms = objPhys.getMotionState();
		if ( ms ) {
			ms.getWorldTransform( transformAux1 );
			var p = transformAux1.getOrigin();
			var q = transformAux1.getRotation();
			objThree.position.set( p.x(), p.y(), p.z() );
			objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
			objThree.userData.collided = false;
		}
	}
	for ( var i = 0, il = dispatcher.getNumManifolds(); i < il; i ++ ) {
		var contactManifold = dispatcher.getManifoldByIndexInternal( i );
		var rb0 = Ammo.castObject( contactManifold.getBody0(), Ammo.btRigidBody );
		var rb1 = Ammo.castObject( contactManifold.getBody1(), Ammo.btRigidBody );
		var threeObject0 = Ammo.castObject( rb0.getUserPointer(), Ammo.btVector3 ).threeObject;
		var threeObject1 = Ammo.castObject( rb1.getUserPointer(), Ammo.btVector3 ).threeObject;
		if ( ! threeObject0 && ! threeObject1 ) {
			continue;
		}
		var userData0 = threeObject0 ? threeObject0.userData : null;
		var userData1 = threeObject1 ? threeObject1.userData : null;
		var breakable0 = userData0 ? userData0.breakable : false;
		var breakable1 = userData1 ? userData1.breakable : false;
		var collided0 = userData0 ? userData0.collided : false;
		var collided1 = userData1 ? userData1.collided : false;
		if ( ( ! breakable0 && ! breakable1 ) || ( collided0 && collided1 ) ) {
			continue;
		}
		var contact = false;
		var maxImpulse = 0;
		for ( var j = 0, jl = contactManifold.getNumContacts(); j < jl; j ++ ) {
			var contactPoint = contactManifold.getContactPoint( j );
			if ( contactPoint.getDistance() < 0 ) {
				contact = true;
				var impulse = contactPoint.getAppliedImpulse();
				if ( impulse > maxImpulse ) {
					maxImpulse = impulse;
					var pos = contactPoint.get_m_positionWorldOnB();
					var normal = contactPoint.get_m_normalWorldOnB();
					impactPoint.set( pos.x(), pos.y(), pos.z() );
					impactNormal.set( normal.x(), normal.y(), normal.z() );
				}
				break;
			}
		}
		// If no point has contact, abort
		if ( ! contact ) continue;
		// Subdivision
		var fractureImpulse = 250;
		if ( breakable0 && ! collided0 && maxImpulse > fractureImpulse ) {
			var debris = convexBreaker.subdivideByImpact( threeObject0, impactPoint, impactNormal, 1, 2, 1.5 );
			var numObjects = debris.length;
			for ( var j = 0; j < numObjects; j ++ ) {
				var vel = rb0.getLinearVelocity();
				var angVel = rb0.getAngularVelocity();
				var fragment = debris[ j ];
				fragment.userData.velocity.set( vel.x(), vel.y(), vel.z() );
				fragment.userData.angularVelocity.set( angVel.x(), angVel.y(), angVel.z() );
				createDebrisFromBreakableObject( fragment );
			}
			objectsToRemove[ numObjectsToRemove ++ ] = threeObject0;
			userData0.collided = true;
		}
		if ( breakable1 && ! collided1 && maxImpulse > fractureImpulse ) {
			var debris = convexBreaker.subdivideByImpact( threeObject1, impactPoint, impactNormal, 1, 2, 1.5 );
			var numObjects = debris.length;
			for ( var j = 0; j < numObjects; j ++ ) {
				var vel = rb1.getLinearVelocity();
				var angVel = rb1.getAngularVelocity();
				var fragment = debris[ j ];
				fragment.userData.velocity.set( vel.x(), vel.y(), vel.z() );
				fragment.userData.angularVelocity.set( angVel.x(), angVel.y(), angVel.z() );
				createDebrisFromBreakableObject( fragment );
			}
			objectsToRemove[ numObjectsToRemove ++ ] = threeObject1;
			userData1.collided = true;
		}
	}
	for ( var i = 0; i < numObjectsToRemove; i ++ ) {
		removeDebris( objectsToRemove[ i ] );
	}
	numObjectsToRemove = 0;
}

function loadFont( fontObj ) {
	const loader = new THREE.FontLoader();
	loader.load( 'fonts/droid/droid_sans_bold.typeface.json',  ( response ) => {
		fontObj.font = response;
		refreshText(fontObj);
	} );
};

function createTextMesh( fontObj ) {
    const materials = [
	    new THREE.MeshPhongMaterial( { color: 0x27AE60, flatShading: true } ), // front
	    new THREE.MeshPhongMaterial( { color: 0x27AE60 } ) // side
    ];
	const textGeo = new THREE.TextGeometry( fontObj.text, {
		font: fontObj.font,
		size: fontObj.size,
		height: fontObj.height,
		curveSegments: fontObj.curveSegments,
		bevelThickness: fontObj.bevelThickness,
		bevelSize: fontObj.bevelSize,
		bevelEnabled: fontObj.bevelEnabled
	} );
	textGeo.computeBoundingBox();
	textGeo.computeVertexNormals();
	// "fix" side normals by removing z-component of normals for side faces
	// (this doesn't work well for beveled geometry as then we lose nice curvature around z-axis)
	if ( ! fontObj.bevelEnabled ) {
		var triangleAreaHeuristics = 0.1 * ( fontObj.height * fontObj.size );
		for ( var i = 0; i < textGeo.faces.length; i ++ ) {
			var face = textGeo.faces[ i ];
			if ( face.materialIndex == 1 ) {
				for ( let j = 0; j < face.vertexNormals.length; j ++ ) {
					face.vertexNormals[ j ].z = 0;
					face.vertexNormals[ j ].normalize();
				}
				var va = textGeo.vertices[ face.a ];
				var vb = textGeo.vertices[ face.b ];
				var vc = textGeo.vertices[ face.c ];
				var s = GeometryUtils.triangleArea( va, vb, vc );
				if ( s > triangleAreaHeuristics ) {
					for ( let j = 0; j < face.vertexNormals.length; j ++ ) {
						face.vertexNormals[ j ].copy( face.normal );
					}
				}
			}
		}
	}
	var centerOffset = - 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );
	const textBufGeo = new THREE.BufferGeometry().fromGeometry( textGeo );
	const textMesh1 = new THREE.Mesh( textBufGeo, materials );
	textMesh1.position.x = centerOffset;
	textMesh1.position.y = fontObj.hover;
	textMesh1.position.z = 0;
	textMesh1.rotation.x = 0;
	textMesh1.rotation.y = Math.PI * 2;
    return textMesh1;
};

