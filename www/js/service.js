//global services go here

angular.module( 'omniwallet' ).factory('userService', ['$rootScope', '$http', function ($rootScope, $http) {
  var service = {
    data: {
      addresses: [],
      email: '',
      loggedIn: false
    },

    login: function(wallet) {
      service.data.addresses = wallet.addresses;
      service.data.email = wallet.email;
      service.data.loggedIn = true;
      service.saveSession();
    },

    logout: function() {
      //Pain point as this grows
      service.data.email = '',
      service.data.loggedIn = false;
      service.data.addresses = [];
      localStorage.clear();
    },

    addAddress: function( address, privKey ) {
      for( var i in service.data.addresses )
      {
        if( service.data.addresses[i].address == address )
        {
          service.data.addresses[i].privkey = privKey;
          service.saveSession();
          return;
        }
      }
      service.data.addresses.push( {
        "address": address,
        "privkey": privKey
      });
      service.data.loggedIn = true;
      service.saveSession();
    },

    getAddress: function(address) {
      for(var i in service.data.addresses) {
        if(service.data.addresses[i].address == address) {
          return service.data.addresses[i];
        }
      }
    },

    removeAddress: function( address ) {
      for( var i=0; i<service.data.addresses.length; i++ )
        if( service.data.addresses[i].address == address )
        {
          service.data.addresses.splice( i, 1 );
          service.saveSession();
          return;
        }

      if(service.data.addresses.length == 0) {
        //Consider this a log out as well?
        service.data.loggedIn = false;
        service.saveSession();
      }
    },

    syncWallet: function() {
      var wallet = {
        email: service.data.email,
        addresses: service.data.addresses
      };
      // Strange serialization effects, stringifying wallet initially
      var postData = {
        type: 'SYNCWALLET',
        wallet: JSON.stringify(wallet)
      };
      return $http({
        url: '/v1/user/wallet/sync/',
        method: 'POST',
        data: postData,
        headers: {'Content-Type': 'application/json'}
      })
    },

    saveSession: function () {
      localStorage["OmniWallet"] = angular.toJson(service.data);
      service.syncWallet().success(function() { console.log("Success saving"); });
    },
    restoreSession: function() {
      if( localStorage[ "OmniWallet" ])
        service.data = angular.fromJson(localStorage["OmniWallet"]);
    }
  };

  // $rootScope.$watch('userService.data', function(newVal, oldVal) {
  //   console.log("watched");
  //   $rootScope.$broadcast('savestate');
  // }, true);
  $rootScope.$on("savestate", service.saveSession);
  $rootScope.$on("restorestate", service.restoreSession);

  service.restoreSession();

  return service;
}]);

angular.module( 'omniwallet' ).factory( 'appraiser', ['$rootScope', '$http', function ( $rootScope, $http ) {

  // Rewire to use localstorage 
  function AppraiserService() {
    this.conversions = {};
    var self = this;
    function BtcUpdateLoop() {
      self.updateBtcValue( function() {
        setTimeout( BtcUpdateLoop, 30000 );
      } );
    }
    function MscUpdateLoop() {
      self.updateMscValue( function() {
        setTimeout( MscUpdateLoop, 600000 );
      } );
    }
    BtcUpdateLoop();
    MscUpdateLoop();
  };
  AppraiserService.prototype.updateBtcValue = function( callback ) {
    var self = this;
    $http.get( 'https://api.bitcoinaverage.com/all' ).then( function( result ) {
      self.conversions.BTC = result.data.USD.averages.last;
      $rootScope.$emit( 'APPRAISER_VALUE_CHANGED', 'BTC' );
      callback();
    }, function( error ) {
      console.log( error );
      callback();
    });
  };
  AppraiserService.prototype.updateMscValue = function( callback ) {
    var self = this;
    $http.get( 'https://masterxchange.com/api/trades.php' ).then( function( result ) {
      var volume = 0;
      var sum = 0;

      for( var i=0; i<result.data.length; i++ )
      {
        volume += parseFloat( result.data[i].amount );
        sum += parseFloat( result.data[i].amount ) * parseFloat( result.data[i].price );
      }

      self.conversions.MSC = sum / volume;
      $rootScope.$emit( 'APPRAISER_VALUE_CHANGED', 'MSC' );
      callback();
    }, function( error ) {
      console.log( error );
      callback();
    });
  };
  AppraiserService.prototype.getValue = function( amount, symbol ) {
    if( symbol == 'TMSC' )
      return 0;
    else if( symbol == 'BTC' )
    {
      if( this.conversions.BTC )
        return this.conversions.BTC * amount;
      else
        return 'BTC Value Unavailable';
    }
    else
    {
      if( this.conversions.MSC )
      {
        return this.getValue( this.conversions.MSC * amount, 'BTC' );
      }
      else
        return 'MSC Value Unavailable';
    }
  };

  return new AppraiserService();
}]);
