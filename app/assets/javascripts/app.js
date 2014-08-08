'use strict';

// Declare here that angular is the US version - other locales can be easily substituted.

require([ 'angular', 'angular-route', 'angular-resource', 'angular-cookies', 'underscorejs'], function (angular) {

    function MoodlyCtrl($scope, $http, $location) {
        console.log('MoodlyCtrl');
        $scope.moodlyUrl = '';
        $scope.baseUrl = $location.protocol() + "://" + $location.host();
        if ($location.port() != "80") {
            $scope.baseUrl += ":" + $location.port();
        }
        console.log($location);
        $scope.moodly = {};
        $scope.moodly.interval = 7;
        $scope.createMoodly = function(data) {
            console.log($scope.moodly.interval);
            if (!$scope.moodly.interval || parseInt($scope.moodly.interval) < 1) {
                //console.log(interval_form.interval.$error);
                return;
            }
            $http.post('/rest/moodlies', {
                intervalDays: parseInt($scope.moodly.interval)
            }).success(function(data) {
                $scope.moodlyUrl = '/#/voting/' + data.id;
            });
        };
    }

    function VotingCtrl($scope, $routeParams, $resource, $cookieStore, $window, CookieService) {

        $scope.moodlyId = $routeParams.id;

        $resource('/rest/moodlies/:moodlyId/currentIterationCount', {moodlyId:$routeParams.id}).get(function(data) {
            var currentIterationCount = data[0];
            console.log("currentIterationCount=" + currentIterationCount);
            var cookieKey = "moodly-" + $routeParams.id;
            var cookie = ($cookieStore.get(cookieKey)) ? JSON.parse($cookieStore.get(cookieKey)) : {};
            console.log(cookie);
            if (cookie.currentIterationCount == currentIterationCount) {
                console.log("user has cookie!");
                $window.location.hash = "/alreadyvoted/" + $routeParams.id;
            } else {

                // TODO: this is a minor race condition
                $scope.vote = function (ballot) {
                    var cookieId = Math.random();
                    var Ballot = $resource('/rest/moodlies/:moodlyId/ballots', {moodlyId: $routeParams.id}, {});

                    CookieService.put($routeParams.id, {cookieId: cookieId, ballot: ballot, currentIterationCount: parseInt(data[0], 10)});

                    Ballot.save({cookieId: cookieId.toString(), vote: ballot});
                    console.log(ballot);
                    $window.location.hash = "/voted/" + $routeParams.id;
                };
            }
        });

    }

    function AlreadyVotedCtrl($scope, $routeParams, $resource, CookieService) {
        VotedCtrlInternal($scope, $routeParams, $resource, CookieService, true)
    }

    function VotedCtrl($scope, $routeParams, $resource, CookieService) {
        VotedCtrlInternal($scope, $routeParams, $resource, CookieService, false)
    }

    function VotedCtrlInternal($scope, $routeParams, $resource, CookieService, alreadyVoted) {
        var moodlyId = $routeParams.id;
        $scope.ballot = CookieService.get($routeParams.id).ballot;
        $scope.alreadyVoted = alreadyVoted;
        $scope.moodlyId = moodlyId;

        var Ballot = ballotResource($resource, moodlyId);

        Ballot.get(function(ballots) {
            var cIC = CookieService.get($routeParams.id).currentIterationCount;
            console.log(ballots);
            // calculate the average for one iteration
            $scope.avg = averageVote(ballots, cIC);

            $scope.personCount = numberOfPersonForIteration(ballots, cIC);
        });
    }

    function averageVote(ballots, iterationCount) {
        var ballotsForIteration = _.filter(ballots, function(b) {
           return b.iterationCount == iterationCount
        });

        if (ballotsForIteration.length !== 0) {
            var sum = ballotsForIteration.reduce(function (acc, b) {
                return acc + b.vote
            }, 0);
            return Math.round((sum / ballotsForIteration.length) * 100) / 100;
        } else return null;
    }

    function numberOfPersonForIteration(ballots, iterationCount) {
        return (ballots.reduce(function(acc, b) {
            return acc + (b.iterationCount == iterationCount ? 1 : 0)
        }, 0));
    }

    function moodlyResource($resource, moodlyId) {
        return $resource('/rest/moodlies/:moodlyId', {moodlyId: moodlyId},
            {
                get : {
                    method: 'GET'
                }
            }
        );
    }
    function ballotResource($resource, moodlyId) {
        return $resource('/rest/moodlies/:moodlyId/ballots', {moodlyId: moodlyId},
            {
                get : {
                    method: 'GET',
                    isArray: true
                }
            }
        );
    }

    function StatsCtrl($scope, $routeParams, $resource, $q) {
        var moodlyId = $routeParams.id;
        $scope.moodlyId = moodlyId;

        $q.all([
            ballotResource($resource, moodlyId).get().$promise,
            moodlyResource($resource, moodlyId).get().$promise
        ]).then(function(data) {
            var ballots = data[0];
            var moodly = data[1];

            $scope.intervalDays = moodly.intervalDays;
            var start = new Date(moodly.start);

            var stats = [],
                max = _.max(_.map(ballots, function(b) {
                    return b.iterationCount;
                }));

            for (var it = 0; it <= max; it++) {
                stats[it] = {
                    "iteration": it,
                    "startDate": addDays(start, it * moodly.intervalDays),
                    "endDate": addDays(start, (it + 1) * moodly.intervalDays),
                    "average": averageVote(ballots, it),
                    "personsCount": numberOfPersonForIteration(ballots, it)
                };
            }
            $scope.stats = stats;

        });
    }

    function addDays(date, days) {
        var result = new Date(date);
        result.setDate(date.getDate() + days);
        return result;
    }

    function StatsConfigCtrl($scope, $routeParams, $resource) {

    }

    angular.module('moodly', ['ngRoute', 'ngResource', 'ngCookies' ]);

    angular.module('moodly').service('CookieService', function($cookieStore) {
        this.get = function(cookieName) {
            var cookieKey = "moodly-" + cookieName;
            return ($cookieStore.get(cookieKey)) ? JSON.parse($cookieStore.get(cookieKey)) : {};
        };

        this.put = function(cookieName, data) {
            var cookieKey = "moodly-" + cookieName;
            $cookieStore.put(cookieKey, JSON.stringify(data));
        };
    });

    angular.module('moodly').config(['$routeProvider', function ($routeProvider) {
        $routeProvider.when('/', {
            templateUrl: 'partials/moodlies.html',
            controller: MoodlyCtrl,
            reloadOnSearch: false
        }).when('/voting/:id', {
            templateUrl: 'partials/voting.html',
            controller: VotingCtrl,
            reloadOnSearch: false
        }).when('/voted/:id', {
            templateUrl: 'partials/voted.html',
            controller: VotedCtrl,
            reloadOnSearch: false
        }).when('/alreadyvoted/:id', {
            templateUrl: 'partials/voted.html',
            controller: AlreadyVotedCtrl,
            reloadOnSearch: false
        }).when('/stats_config/:id', {
            templateUrl: 'partials/stats_config.html',
            controller: StatsConfigCtrl,
            reloadOnSearch: false
        }).when('/stats/:id', {
            templateUrl: 'partials/stats.html',
            controller: StatsCtrl,
            reloadOnSearch: false
        }).otherwise({redirectTo: '/'});
    }]);

    angular.bootstrap(document, ['moodly']);


});

