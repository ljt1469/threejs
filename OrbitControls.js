/**
 * @author Jason Lee 676574039@qq.com
 */

THREE.OrbitControls = function ( object, domElement ) {
	var _this = this; //Track
	var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };//Track
	var touch = false;
    this.object = object;
    this.domElement = ( domElement !== undefined ) ? domElement : document;
	
    // API

    this.enabled = true;

    this.center = new THREE.Vector3();

    this.userZoom = true;
    this.userZoomSpeed = 1.0;

    this.userRotate = true;
    this.userRotateSpeed = 1.0;

    this.userPan = true;
    this.userPanSpeed = 2.0;

    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };
//==============================================================//Track
	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	this.rotateSpeed = 1.0;
	this.zoomSpeed = 1.2;
	this.panSpeed = 0.3;

	this.noRotate = false;
	this.noZoom = false;
	this.noPan = false;
	this.noRoll = false;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.2;

	this.minDistance = 0;
	this.maxDistance = Infinity;
	// internals

	this.target = new THREE.Vector3();

	var EPS = 0.000001;

	var lastPosition = new THREE.Vector3();

	var _state = STATE.NONE,
	_prevState = STATE.NONE,

	_eye = new THREE.Vector3(),

	_rotateStart = new THREE.Vector3(),
	_rotateEnd = new THREE.Vector3(),

	_zoomStart = new THREE.Vector2(),
	_zoomEnd = new THREE.Vector2(),

	_touchZoomDistanceStart = 0,
	_touchZoomDistanceEnd = 0,

	_panStart = new THREE.Vector2(),
	_panEnd = new THREE.Vector2();
	
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.up0 = this.object.up.clone();
//==============================================================//Track
    // internals

    var scope = this;

    var EPS = 0.000001;
    var PIXELS_PER_ROUND = 1800;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var zoomStart = new THREE.Vector2();
    var zoomEnd = new THREE.Vector2();
    var zoomDelta = new THREE.Vector2();

    var phiDelta = 0;
    var thetaDelta = 0;
    var scale = 1;

    var lastPosition = new THREE.Vector3();

    //var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
    var state = STATE.NONE;

    // events
	
    var changeEvent = { type: 'change' };
	var startEvent = { type: 'start'};//Track
	var endEvent = { type: 'end'};//Track

//============================================================
	this.handleResize = function () {

		if ( this.domElement === document ) {

			this.screen.left = 0;
			this.screen.top = 0;
			this.screen.width = window.innerWidth;
			this.screen.height = window.innerHeight;

		} else {

			var box = this.domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = this.domElement.ownerDocument.documentElement;
			this.screen.left = box.left + window.pageXOffset - d.clientLeft;
			this.screen.top = box.top + window.pageYOffset - d.clientTop;
			this.screen.width = box.width;
			this.screen.height = box.height;

		}

	};

	this.handleEvent = function ( event ) {

		if ( typeof this[ event.type ] == 'function' ) {

			this[ event.type ]( event );

		}

	};

	var getMouseOnScreen = ( function () {

		var vector = new THREE.Vector2();

		return function ( pageX, pageY ) {

			vector.set(
				( pageX - _this.screen.left ) / _this.screen.width,
				( pageY - _this.screen.top ) / _this.screen.height
			);

			return vector;

		};

	}() );

	var getMouseProjectionOnBall = ( function () {

		var vector = new THREE.Vector3();
		var objectUp = new THREE.Vector3();
		var mouseOnBall = new THREE.Vector3();

		return function ( pageX, pageY ) {

			mouseOnBall.set(
				( pageX - _this.screen.width * 0.5 - _this.screen.left ) / (_this.screen.width*.5),
				( _this.screen.height * 0.5 + _this.screen.top - pageY ) / (_this.screen.height*.5),
				0.0
			);

			var length = mouseOnBall.length();

			if ( _this.noRoll ) {

				if ( length < Math.SQRT1_2 ) {

					mouseOnBall.z = Math.sqrt( 1.0 - length*length );

				} else {

					mouseOnBall.z = .5 / length;
					
				}

			} else if ( length > 1.0 ) {

				mouseOnBall.normalize();

			} else {

				mouseOnBall.z = Math.sqrt( 1.0 - length * length );

			}

			_eye.copy( _this.object.position ).sub( _this.target );

			vector.copy( _this.object.up ).setLength( mouseOnBall.y )
			vector.add( objectUp.copy( _this.object.up ).cross( _eye ).setLength( mouseOnBall.x ) );
			vector.add( _eye.setLength( mouseOnBall.z ) );

			return vector;

		};

	}() );

	this.rotateCamera = (function(){

		var axis = new THREE.Vector3(),
			quaternion = new THREE.Quaternion();


		return function () {

			var angle = Math.acos( _rotateStart.dot( _rotateEnd ) / _rotateStart.length() / _rotateEnd.length() );

			if ( angle ) {

				axis.crossVectors( _rotateStart, _rotateEnd ).normalize();

				angle *= _this.rotateSpeed;

				quaternion.setFromAxisAngle( axis, -angle );

				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

				_rotateEnd.applyQuaternion( quaternion );

				if ( _this.staticMoving ) {

					_rotateStart.copy( _rotateEnd );

				} else {

					quaternion.setFromAxisAngle( axis, angle * ( _this.dynamicDampingFactor - 1.0 ) );
					_rotateStart.applyQuaternion( quaternion );

				}

			}
		}

	}());

	this.zoomCamera = function () {

		if ( _state === STATE.TOUCH_ZOOM_PAN ) {

			var factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
			_touchZoomDistanceStart = _touchZoomDistanceEnd;
			_eye.multiplyScalar( factor );

		} else {

			var factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * _this.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {

				_eye.multiplyScalar( factor );

				if ( _this.staticMoving ) {

					_zoomStart.copy( _zoomEnd );

				} else {

					_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;

				}

			}

		}

	};

	this.panCamera = (function(){

		var mouseChange = new THREE.Vector2(),
			objectUp = new THREE.Vector3(),
			pan = new THREE.Vector3();

		return function () {

			mouseChange.copy( _panEnd ).sub( _panStart );

			if ( mouseChange.lengthSq() ) {

				mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

				pan.copy( _eye ).cross( _this.object.up ).setLength( mouseChange.x );
				pan.add( objectUp.copy( _this.object.up ).setLength( mouseChange.y ) );

				_this.object.position.add( pan );
				_this.target.add( pan );

				if ( _this.staticMoving ) {

					_panStart.copy( _panEnd );

				} else {

					_panStart.add( mouseChange.subVectors( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

				}

			}
		}

	}());

	this.checkDistances = function () {

		if ( !_this.noZoom || !_this.noPan ) {

			if ( _eye.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.maxDistance ) );

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.minDistance ) );

			}

		}

	};

	this.UpdateT = function () {

		_eye.subVectors( _this.object.position, _this.target );

		if ( !_this.noRotate ) {

			_this.rotateCamera();

		}

		if ( !_this.noZoom ) {

			_this.zoomCamera();

		}

		if ( !_this.noPan ) {

			_this.panCamera();

		}

		_this.object.position.addVectors( _this.target, _eye );

		_this.checkDistances();

		_this.object.lookAt( _this.target );

		if ( lastPosition.distanceToSquared( _this.object.position ) > EPS ) {

			_this.dispatchEvent( changeEvent );

			lastPosition.copy( _this.object.position );

		}

	};
	
	this.reset = function () {

		_state = STATE.NONE;
		_prevState = STATE.NONE;

		_this.target.copy( _this.target0 );
		_this.object.position.copy( _this.position0 );
		_this.object.up.copy( _this.up0 );

		_eye.subVectors( _this.object.position, _this.target );

		_this.object.lookAt( _this.target );

		_this.dispatchEvent( changeEvent );

		lastPosition.copy( _this.object.position );

	};
	
	function touchstart( event ) {
			touch = true;
		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_state = STATE.TOUCH_ROTATE;
				_rotateStart.copy( getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_rotateEnd.copy( _rotateStart );
				break;

			case 2:
				_state = STATE.TOUCH_ZOOM_PAN;
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panStart.copy( getMouseOnScreen( x, y ) );
				_panEnd.copy( _panStart );
				break;

			default:
				_state = STATE.NONE;

		}
		_this.dispatchEvent( startEvent );


	}

	function touchmove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1:
				_rotateEnd.copy( getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				break;

			case 2:
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panEnd.copy( getMouseOnScreen( x, y ) );
				break;

			default:
				_state = STATE.NONE;

		}

	}

	function touchend( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_rotateEnd.copy( getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_rotateStart.copy( _rotateEnd );
				break;

			case 2:
				_touchZoomDistanceStart = _touchZoomDistanceEnd = 0;

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panEnd.copy( getMouseOnScreen( x, y ) );
				_panStart.copy( _panEnd );
				break;

		}

		_state = STATE.NONE;
		_this.dispatchEvent( endEvent );
		

	}
//============================================================
    this.rotateLeft = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        thetaDelta -= angle;

    };

    this.rotateRight = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        thetaDelta += angle;

    };

    this.rotateUp = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        phiDelta -= angle;

    };

    this.rotateDown = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        phiDelta += angle;

    };

    this.zoomIn = function ( zoomScale ) {

        if ( zoomScale === undefined ) {

            zoomScale = getZoomScale();

        }

        scale /= zoomScale;

    };

    this.zoomOut = function ( zoomScale ) {

        if ( zoomScale === undefined ) {

            zoomScale = getZoomScale();

        }

        scale *= zoomScale;

    };

    this.pan = function ( distance ) {

        distance.transformDirection( this.object.matrix );
        distance.multiplyScalar( scope.userPanSpeed );

        this.object.position.add( distance );
        this.center.add( distance );

    };

    this.UpdateO = function () {

        var position = this.object.position;
        var offset = position.clone().sub( this.center );

        // angle from z-axis around y-axis

        var theta = Math.atan2( offset.x, offset.z );

        // angle from y-axis

        var phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );

        if ( this.autoRotate ) {

            this.rotateLeft( getAutoRotationAngle() );

        }

        theta += thetaDelta;
        phi += phiDelta;

        // restrict phi to be between desired limits
        phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );

        // restrict phi to be betwee EPS and PI-EPS
        phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );

        var radius = offset.length() * scale;

        // restrict radius to be between desired limits
        radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );

        offset.x = radius * Math.sin( phi ) * Math.sin( theta );
        offset.y = radius * Math.cos( phi );
        offset.z = radius * Math.sin( phi ) * Math.cos( theta );

        position.copy( this.center ).add( offset );

        this.object.lookAt( this.center );

        thetaDelta = 0;
        phiDelta = 0;
        scale = 1;

        if ( lastPosition.distanceTo( this.object.position ) > 0 ) {

            this.dispatchEvent( changeEvent );

            lastPosition.copy( this.object.position );

        }

    };
	
	this.update = function () {
			if(touch){
			this.UpdateO();
			this.UpdateT();	
			}else{
			this.UpdateT();
			this.UpdateO();
			touch = false;
			}
	}


    function getAutoRotationAngle() {

        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

    }

    function getZoomScale() {

        return Math.pow( 0.95, scope.userZoomSpeed );

    }

    function onMouseDown( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userRotate === false ) return;

        event.preventDefault();

        if ( event.button === 0 ) {

            state = STATE.ROTATE;

            rotateStart.set( event.clientX, event.clientY );

        } else if ( event.button === 1 ) {

            state = STATE.ZOOM;

            zoomStart.set( event.clientX, event.clientY );

        } else if ( event.button === 2 ) {

            state = STATE.PAN;

        }

        document.addEventListener( 'mousemove', onMouseMove, false );
        document.addEventListener( 'mouseup', onMouseUp, false );

    }

    function onMouseMove( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();

        if ( state === STATE.ROTATE ) {

            rotateEnd.set( event.clientX, event.clientY );
            rotateDelta.subVectors( rotateEnd, rotateStart );

            scope.rotateLeft( 2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed );
            scope.rotateUp( 2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed );

            rotateStart.copy( rotateEnd );

        } else if ( state === STATE.ZOOM ) {

            zoomEnd.set( event.clientX, event.clientY );
            zoomDelta.subVectors( zoomEnd, zoomStart );

            if ( zoomDelta.y > 0 ) {

                scope.zoomIn();

            } else {

                scope.zoomOut();

            }

            zoomStart.copy( zoomEnd );

        } else if ( state === STATE.PAN ) {

            var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            scope.pan( new THREE.Vector3( - movementX, movementY, 0 ) );

        }

    }

    function onMouseUp( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userRotate === false ) return;

        document.removeEventListener( 'mousemove', onMouseMove, false );
        document.removeEventListener( 'mouseup', onMouseUp, false );

        state = STATE.NONE;

    }

    function onMouseWheel( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userZoom === false ) return;

        var delta = 0;

        if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

            delta = event.wheelDelta;

        } else if ( event.detail ) { // Firefox

            delta = - event.detail;

        }

        if ( delta > 0 ) {

            scope.zoomOut();

        } else {

            scope.zoomIn();

        }

    }

    function onKeyDown( event ) {

        if ( scope.enabled === false ) return;
        if ( scope.userPan === false ) return;

        switch ( event.keyCode ) {

            case scope.keys.UP:
                scope.pan( new THREE.Vector3( 0, 1, 0 ) );
                break;
            case scope.keys.BOTTOM:
                scope.pan( new THREE.Vector3( 0, - 1, 0 ) );
                break;
            case scope.keys.LEFT:
                scope.pan( new THREE.Vector3( - 1, 0, 0 ) );
                break;
            case scope.keys.RIGHT:
                scope.pan( new THREE.Vector3( 1, 0, 0 ) );
                break;
        }

    }

    this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
    this.domElement.addEventListener( 'mousedown', onMouseDown, false );
    this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox
    this.domElement.addEventListener( 'keydown', onKeyDown, false );
	this.domElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchend, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );
	
	this.handleResize();

	// force an update at start
	this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
