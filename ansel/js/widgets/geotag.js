/**
 * Geotagging widget
 *
 * Copyright 2009-2011 Horde LLC (http://www.horde.org/)
 *
 * See the enclosed file COPYING for license information (GPL). If you
 * did not receive this file, see http://www.fsf.org/copyleft/gpl.html.
 *
 * @author Michael J. Rubinsky <mrubinsk@horde.org>
 */
AnselGeoTagWidget = Class.create({
    _bigMap: null,
    _smallMap: null,
    _images: null,
    locationId: 'ansel_locationtext',
    coordId: 'ansel_latlng',
    relocateId: 'ansel_relocate',
    deleteId: 'ansel_deleteGeotag',
    opts: null,
    _iLayer: null,

    /**
     * Const'r.
     *
     * Required opts:
     *   viewType [Gallery|Image]
     *   relocateUrl [Url for relocate popup]
     *   relocateText [Localized text]
     *   deleteGeotagText [Localized text]
     *   hasEdit [boolean do we have PERMS_EDIT?]
     *   updateEndPoint [AJAX endpoint for updating image data]
     */
    initialize: function(imgs, opts) {
         var o = {
            smallMap: 'ansel_map_small',
            mainMap:  'ansel_map',
            geocoder: 'None',
            calculateMaxZoom: true,
            deleteGeotagCallback: this.deleteLocation.bind(this)
        };
        this._images = imgs;
        this.opts = Object.extend(o, opts || {});
    },

    setLocation: function(img, lat, lng)  {
        var params = { 'values': 'img=' + img + '/lat=' + lat + '/lng=' + lng };

        new Ajax.Request(this.opts.updateEndpoint + '/action=geotag/post=values', {
            method: 'post',
            parameters: params,
            onComplete: function(transport) {
                 if (typeof Horde_ToolTips != 'undefined') {
                     Horde_ToolTips.out();
                 }
                 if (transport.responseJSON.response == 1) {
                    var w = new Element('div');
                    w.appendChild(new Element('div', {id: 'ansel_map'}));
                    var ag = new Element('div', {'class': 'ansel_geolocation'});
                    ag.appendChild(new Element('div', {id: 'ansel_locationtext'}));
                    ag.appendChild(new Element('div', {id: 'ansel_latlng'}));
                    ag.appendChild(new Element('div', {id: 'ansel_relocate'}));
                    ag.appendChild(new Element('div', {id: 'ansel_deleteGeotag'}));
                    w.appendChild(ag);
                    w.appendChild(new Element('div', {id: 'ansel_map_small'}));
                    $('ansel_geo_widget').update(w);
                    this._images.unshift({
                        image_id: img,
                        image_latitude: lat,
                        image_longitude: lng,
                        image_location: '',
                        markerOnly: true
                    });
                    this.doMap();
                 }
             }.bind(this)
        });
    },

    deleteLocation: function(iid) {
        var params = { 'values': 'img=' + iid };
        new Ajax.Request(this.opts.updateEndpoint + '/action=untag/post=values', {
            method: 'post',
            parameters: params,
            onComplete: function(transport) {
                if (transport.responseJSON.response == 1) {
                    $('ansel_geo_widget').update(transport.responseJSON.message);
                }
            }
        });
    },

    doMap: function() {
        // Create map and geocoder objects
        this._bigMap = AnselMap.initMainMap('ansel_map', {
            'onHover': function(e) {
                switch (e.type) {
                case 'beforefeaturehighlighted':
                    break;
                case 'featurehighlighted':
                    if (this.opts.viewType == 'Gallery') {
                        $$('#imagetile_' + e.feature.attributes.image_id + ' img')[0].toggleClassName('image-tile-highlight');
                    }
                    break;
                case 'featureunhighlighted':
                    if (this.opts.viewType == 'Gallery') {
                        $$('#imagetile_' + e.feature.attributes.image_id + ' img')[0].toggleClassName('image-tile-highlight');
                    }
                }
                return true;
            }.bind(this),

            'onClick': function(f) {
                var uri = f.feature.attributes.image_link;
                location.href = uri;
            }.bind(this),
            'imageLayer': (this.opts.viewType == 'Image') ? true : false
        });
        this._smallMap = AnselMap.initMiniMap('ansel_map_small', {});
        this.geocoder = new HordeMap.Geocoder[this.opts.geocoder](this._bigMap.map, 'ansel_map');

        // Place the image markers
        var m, centerImage;
        for (var i = 0; i < this._images.length; i++) {
            if (this._images[i].markerOnly) {
                centerImage = this._images[i];
                 (function() {
                    var p = this._images[i];
                    var f = m;
                    this.getLocation(p, m);
                }.bind(this))();
                continue;
            }
            m = AnselMap.placeMapMarker(
                'ansel_map',
                {
                    'lat': this._images[i].image_latitude,
                    'lon': this._images[i].image_longitude
                },
                {
                    'img': (!this._images[i].markerOnly) ? this._images[i].icon : Ansel.conf.markeruri,
                    'background': (!this._images[i].markerOnly) ? Ansel.conf.pixeluri + '?c=ffffff' : Ansel.conf.shadowuri,
                    'image_id': this._images[i].image_id,
                    'markerOnly': (this._images[i].markerOnly) ? 'markerOnly' : 'noMarkerOnly',
                    'center': false,
                    'image_link': this._images[i].link
                }
            );

            // Watch for hover on imagetiles too, need closures
            if (this.opts.viewType == 'Gallery') {
                (function() {
                    var f = m;
                    $$('#imagetile_' + this._images[i].image_id + ' img')[0].observe(
                        'mouseover',
                        function(e) {
                            AnselMap.selectMarker('ansel_map', f);
                        }
                    );
                    $$('#imagetile_' + this._images[i].image_id + ' img')[0].observe(
                        'mouseout',
                        function(e) {
                            AnselMap.unselectMarker('ansel_map', f);
                        }
                    );
                }.bind(this))();
            }

            AnselMap.placeMapMarker(
                'ansel_map_small',
                {
                    'lat': this._images[i].image_latitude,
                    'lon': this._images[i].image_longitude
                }
            );
        }
        if (centerImage) {
            AnselMap.placeMapMarker(
                'ansel_map',
                {
                    'lat': centerImage.image_latitude,
                    'lon': centerImage.image_longitude
                },
                {
                    'img': (!centerImage.markerOnly) ? centerImage.icon : Ansel.conf.markeruri,
                    'background': (!centerImage.markerOnly) ? Ansel.conf.pixeluri + '?c=ffffff' : Ansel.conf.shadowuri,
                    'image_id': centerImage.image_id,
                    'markerOnly': 'markerOnly',
                    'center': true,
                    'image_link': centerImage.link
                }
            );
        } else {
            //this._bigMap.markerLayer.redraw();
            this._bigMap.zoomToFit();
        }
        // Attempt to make a good guess as to where to center the mini-map
        this._smallMap.setCenter({'lat': this._images[0].image_latitude, 'lon': 0}, 0);
    },

    /**
     * p = image data
     * m = marker
     */
    getLocation: function(p, m) {
        if (p.image_location.length > 0) {
            // Have cached reverse geocode results
            var r = [ { address: p.image_location, lat: p.image_latitude, lon: p.image_longitude, precision: 1 } ];
            this.getLocationCallback(p, false, m, r);
        } else {
            this.geocoder.reverseGeocode(
                { lat: p.image_latitude, lon: p.image_longitude },
                this.getLocationCallback.bind(this).curry(p, true, m),
                this.onError.bind(this));
        }
    },

    /**
     * callback for reverse geocode call
     *
     * @param object i   The image hash
     * @param boolean u  Update the image location in the backend
     * @param object m   Marker
     * @param object r   The AJAX response
     */
    getLocationCallback: function(i, u, m, r)
    {
        // Update image view links
        if (i.markerOnly) {
            if (r.length) {
                r.each(function(result) {
                    if (result.precision == 1) {
                        if (this.locationId) {
                            $(this.locationId).update(result.address);
                        }
                        if (this.coordId) {
                            $(this.coordId).update(AnselMap.point2Deg({ lat: result.lat, lon: result.lon }));
                        }
                        if (this.relocateId) {
                            $(this.relocateId).update(this._getRelocateLink(i.image_id));
                        }
                        if (this.deleteId) {
                            $(this.deleteId).update(this._getDeleteLink(i.image_id));
                        }
                        // Save the results?
                        if (u) {
                            new Ajax.Request(this.opts.updateEndpoint + '/action=location/post=values',
                                {
                                    method: 'post',
                                    parameters: { 'values': 'location=' + encodeURIComponent(result.address) + '/img=' + i.image_id }
                                }
                            );
                        }
                        throw $break;
                   }
               }.bind(this));
           }
        } else if (this.opts.viewType == 'Gallery') {
            // console.log('foobar');
            // $$('#imagetile_' + i.image_id + ' img')[0].observe('mouseover', function(e) {
            //     console.log(e);
            //     e.toggleClassName('image-tile-highlight');
            // });
        }
    },

    onError: function(r)
    {
    },

    _getRelocateLink: function(iid) {
        if (this.opts.hasEdit) {
            var a = new Element('a', {
                href: this.opts.relocateUrl + '?image=' + iid }
            ).update(this.opts.relocateText);

            a.observe('click', function(e) {
                Horde.popup({
                    url: this.opts.relocateUrl,
                    params: 'image=' + iid, width: 750, height: 600
                });
                e.stop();
            }.bind(this));

            return a;
        } else {
            return '';
        }
    },

    _getDeleteLink: function(iid) {
        var x = new Element('a', {
            href: this.opts.relocateUrl + '?image=' + iid }
        ).update(this.opts.deleteGeotagText);

        x.observe('click', function(img, e) {
            this.opts.deleteGeotagCallback(img);
            e.stop();
        }.curry(iid).bindAsEventListener(this));
        return x;
    }

});