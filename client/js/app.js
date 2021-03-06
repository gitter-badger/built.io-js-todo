//Initialize Built.io Backend Application
var BuiltApp       = Built.App('blt7e1db158639f1ede');
var EmployeeRoleID = 'bltf6f2fd41fa4c15f2';

//Create `todoApp` AngularJS module added `ngRoute` as dependency
angular.module('todoApp',['ngRoute'])
  .config(['$routeProvider','$locationProvider', function($routeProvider, $locationProvider){
    $routeProvider
      .when('/', {
        templateUrl : 'template/sign-in.html',
        controller  : 'SignInController'
      })
      .when('/sign-up', {
        templateUrl : 'template/sign-up.html',
        controller  : 'SignUpController'
      })
      .when('/todo', {
        templateUrl : 'template/todo.html',
        controller  : 'TaskListController'
      })
      .when('/google_login', {
        templateUrl : 'template/google-login.html',
        controller  : 'GoogleLoginController'
      })
  }])
  .controller('TaskListController', function($scope, $rootScope, $location, $timeout) {
    $scope.taskList = [];
    $scope.collaborator = {
      email : ""
    }
    /*
      Populate `taskList`
      ===================
      Fetch data from Built.io Backend's
    */
      
      
      /* 
        First get current user 
        and then execute builtQuery 
      */
      BuiltApp.User.getCurrentUser()
        .then(function(user){
          var uid = user.toJSON().uid;
          var authtoken = user.toJSON().authtoken;

          // `BuiltClass` is an instance of Backend class. 
          var BuiltClass = BuiltApp.setAuthToken(authtoken).Class('tasks');

          // `builtQuery` is an instance of Backend's Query.
          var builtQuery = BuiltClass.Query();

          builtQuery
            .exec()
            .then(function(data){
              $sa($scope, function(){
               /* Populate taskList */
                $scope.taskList = data;
              });
            })
        }, function(){
          /* If current user is null, redirect to '/' sign-in route */
          $timeout(function(){
            $location.path('/')
          },0);
        });

    /* Add new task in taskList */
    $scope.addTask = function(){
      
      /* 
        Save task object to Built.io Backend
      */
        
        // BuiltApp.Class('class_name').Object returns a Object constructor
        var Task = BuiltApp.Class('tasks').Object;

        // `newTask` is Object of `Task` constructor
        var newTask = Task({
          task_text   : $scope.taskText,
          task_status : false
        })

        // `newTask` save method create new Object in Built.IO Backend's `tasks` Class
        newTask.save()
          // save method return's a promise
          .then(function(responseObj){
            // On success `responseObj` return a Built.IO Backend's Object we just created
            $sa($scope, function(){
              // add `responseObj` to our `$scope.taskList`
              $scope.taskList.push(responseObj);
              // clear the input text on html form
              $scope.taskText = '';
            })
          })
          .catch(function(error){
            //Show error in alert
            alert(error.entity.error_message)
          })
    }

    /* Delete task */
    $scope.removeTask = function(task){
      //Get index number of task
      var index = $scope.taskList.indexOf(task);
      //Delete from Built.IO Backend
      task.delete()
      .then(function(){
        $sa($scope, function(){
          // Delete task from taskList
          $scope.taskList.splice(index,1);
        })
      });
    }

    /* Update task */
    $scope.updateTask = function(newTask,index){ 
      //Save updated `task` to Built.IO Backend
      newTask.save()
        .then(function(data){
          $sa($scope, function(){
            $scope.taskList.splice(index,1,data);
          })
        });
    }

    /* Edit task text */
    $scope.editTaskText = function(task){
      var index   = $scope.taskList.indexOf(task);
      var text    = prompt("Task Text", task.get('task_text'));
      var newTask = text && task.set('task_text', text);
      if(newTask){
        $scope.updateTask(newTask,index);
      }
    }

    /* Edit task status */
    $scope.editTaskStatus = function(task){
      var index   = $scope.taskList.indexOf(task);
      var newTask = task.set('task_status',task.get('task_status'));
      $scope.updateTask(newTask, index);
    }

    /***********************************************
    * Share a Task with other users (collaborators)
    ***********************************************/

    /* Show Collaboration Box */
    $scope.showCollaborationBox = function(task){
      /*
        Fecth Collaborators Object
      */
      var index         = $scope.taskList.indexOf(task);
      var collaborators = task.get('ACL').users;
      
      if(collaborators){
        // Create array of uid's of Collaborator
        collaborators = task.get('ACL').users.map(function(user){
          //check if user has permission to read, update and delete
          if(user.delete && user.read && user.update){
            return user.uid;
          }
        })

        if(collaborators.length > 0){
          /* 
            Create a query instance which will Query to System Class `built_io_application_user`
            to get collaborators user object
          */
          var queryGetCollaborators = BuiltApp.Class('built_io_application_user').Query();
              queryGetCollaborators
                .containedIn('uid',collaborators)
                .exec()
                .then(function(data){
                  task.collaborators = data;
                  $sa($scope, function(){
                    $scope.taskList.splice(index,1,task);
                  })
              });  
        }
      }


      /* 
        Clear add collaborator form
      */
        $scope.collaborator.email = "";
        $scope.taskList.forEach(function(task){
          delete task.showCollaborationBox;
          delete task.showAttachmentsBox;
        })

        if($scope.taskList[index].showCollaborationBox){
          $scope.taskList[index].showCollaborationBox = false;
        } else {
          $scope.taskList[index].showCollaborationBox = true;
        }


      /* Add New Collaborator */
      $scope.addCollaborator = function(task){
        var index = $scope.taskList.indexOf(task);
        var collaboratorEmail = $scope.collaborator.email;

        if(collaboratorEmail){
          var user    = BuiltApp.User();
          var userUID = "";
          var taskACL = undefined;
          
          user.fetchUserUidByEmail(collaboratorEmail)
            .then(function(userObject){
              console.log('USER OBJECT', userObject);
              userUID = userObject.get('uid');              

                /* 
                  Create instance of Built ACL
                  and set READ, UPDATE and DELETE permission to true
                */
                var acl = Built.ACL();
                    acl = acl.setUserReadAccess(userUID, true);
                    acl = acl.setUserUpdateAccess(userUID, true);
                    acl = acl.setUserDeleteAccess(userUID, true);

                /* 
                  Get ACL of the object and push it in new acl instance 
                */
                if(task.get('ACL').users){
                  task.get('ACL').users.forEach(function(user){
                    acl.data.users.push(user)
                  })
                }
                
                /*
                  Apply ACL on a TASK and Save to Backend.
                */
                task = task.setACL(acl);
                
                task
                  .save()
                  .then(function(task){
                    $sa($scope, function(){
                      $scope.taskList.splice(index, 1, task);
                    })
                    console.log('New Task With ACL', task);
                  }, function(error){
                    console.log('Error', error);
                  })

            }, function(error){
              console.log('Error', error);
            })
        }
      }

      /* Remove Collaborator */
      $scope.removeCollaborator = function(task, collaborator){
        var index = $scope.taskList.indexOf(task);

        /* Get array of all users in ACL and remove current collaborator */
        var aclUsers = task.get('ACL').users.filter(function(user){
          if(user.uid !== collaborator.get('uid')){
            return user.uid;
          }
        }).map(function(user){
          return user.uid;
        });


        /* Create new acl instance */
        var acl = Built.ACL();
        aclUsers.forEach(function(userUID){
          acl = acl.setUserReadAccess(userUID, true);
          acl = acl.setUserUpdateAccess(userUID, true);
          acl = acl.setUserDeleteAccess(userUID, true);
        });

        task
          .setACL(acl)
          .save()
          .then(function(task){
            $sa($scope, function(){
              $scope.taskList.splice(index, 1, task);
            })
          }, function(error){
            console.log('Error', error);
          });
      }
    }

    /*************************************************
    * Show attachments added to current task
    *************************************************/
    $scope.showAttachmentsBox = function(task){
      var index = $scope.taskList.indexOf(task);
      $scope.taskList.forEach(function(task){
        delete task.showCollaborationBox;
        delete task.showAttachmentsBox;
      })

      if($scope.taskList[index].showAttachmentsBox){
        $scope.taskList[index].showAttachmentsBox = false;
      } else {
        $scope.taskList[index].showAttachmentsBox = true;
      }

      $scope.uploadAttachment = function(task){
        var index             = $scope.taskList.indexOf(task);
        var inputFileElements = document.getElementsByClassName('input-file');
        var inputFileElement  = '';

        //Get Current fileElement
        for(var i in inputFileElements){
          if(inputFileElements[i].value){
            inputFileElement = inputFileElements[i];
          }
        }
        
        var upload = BuiltApp.Upload();
            upload = upload.setFile(inputFileElement);

        upload
          .save()
          .then(function(file){
            console.log('Files uploaded successfully!', file);
            //Get all the list of attachments
            var files = task.get('attachments') || [];
                files = files.map(function(file){
                  return file.uid;
                })
            files.push(file.getUid());
            console.log('Files', files);
            task = task.set('attachments', files);

            task
              .save()
              .then(function(data){
                //Update DOM
                $sa($scope, function(){
                  $scope.taskList.splice(index,1,data);
                })
              })
          })
      }

      //Download Attachment
      $scope.downloadAttachment = function(file){
        var upload = BuiltApp.Upload(file.uid);
        upload
          .fetch()
          .then(function(file){
            /* Append AUTHTOKEN as params to URL*/
            file.params.url += '?AUTHTOKEN='+$scope.currentUser.get('authtoken');
            file.download();
          });
        return false;
      }

      //Delete Attachments
      $scope.deleteAttachment = function(task, file){
        var index       = $scope.taskList.indexOf(task);
        var attachments = task.get('attachments');

        //Update Attachments 
        attachments = attachments.filter(function(attachment){
          if(attachment.uid !== file.uid){
            return attachment;
          }
        });

        //Delete a file
        var upload = BuiltApp.Upload(file.uid)
            upload
              .delete()
              .then(function(){
              });

        $sa($scope, function(){
          task = task.set('attachments', attachments);
          $scope.taskList.splice(index,1,task);
        })
      }
    }

  })
  .controller('SignUpController', function($scope, $rootScope) {
    /* Built.IO Backend Application User Sign-Up/Register */
    $scope.signUp = function() {
      /* Create `user` Object */
      var user = BuiltApp.User();
      /* User Registeration */
      user.register($scope.email, $scope.password1, $scope.password2)
          .then(function(user) {
            /* Add current user to role */
            $rootScope.addUserToRole(EmployeeRoleID, user.get('uid'));
            /* Clear Form Elements */
            $sa($scope, function() {
                $scope.email = "";
                $scope.password1 = "";
                $scope.password2 = "";
            })
          }, function(err) {
              console.log('Error', err);
          })
    }
  })
  .controller('SignInController', function($scope, $location, $rootScope) {
      /* Redirect to `todo` route when user is present */
      if ($scope.user || $rootScope.currentUser) {
        return $location.path('/todo');
      }

      /*
        User Sign-In method
      */
      $scope.signIn = function() {
        /* Create a `user` instance from SDK User constructor */
        var user = BuiltApp.User();

        /* Built.io Backend - login method */
        user.login($scope.email, $scope.password)
          .then(function(user) {
            /* 
              Set user on rootscope so It can be accessible to other controller 
            */
            $rootScope.setUser(user);
            /*
              If user logs in successfully redirect to `/todo` route
            */
            $sa($scope, function() {
              $location.path('/todo');
            })

          }, function(error) {
            /*
              If user log-in fails set `$scope.signInStatus`
              This is show error message on log-in route.
            */
            $sa($scope, function() {
                $scope.signInStatus = {
                    "status": false,
                    "message": "Sign-In failed."
                }
            })
          });
      }

      /*
        Sign-in user with Google
      */
      $scope.signInWithGoogle = function() {
        //
        var e = function(u) {
            return encodeURIComponent(u);
        }
        var base = 'https://accounts.google.com/o/oauth2/auth';
        var response_type = e('token');
        var client_id = e('322741339463-m02mbf2ikp9oc9bb930lh8h70hq8s4k0.apps.googleusercontent.com');
        var redirect_uri = e(document.URL.split("/#")[0] + '/google_oauth_callback.html');
        var scope = e('https://www.googleapis.com/auth/userinfo.email');
        var state = e('lollalal');
        var approval_prompt = e('auto');
        var hd = 'raweng.com';

        base = base +
            '?response_type=' + response_type +
            '&client_id=' + client_id +
            '&redirect_uri=' + redirect_uri +
            '&scope=' + scope +
            '&state=' + state +
            '&approval_prompt=' + approval_prompt;
        // + '&hd=' + hd;

        window.location.href = base;
        return false;
      }
  })
  .controller('GoogleLoginController', function($scope, $routeParams, $rootScope, $location) {
    /* Get token from Query Params */
    var google_token = $routeParams.google_token;
    var user = BuiltApp.User();

    /*
      SDK method accepts google auth token
    */
    user.loginWithGoogle(google_token)
        .then(function(user) {
            /* Add current user to role */
            $rootScope.addUserToRole(EmployeeRoleID, user.get('uid'));
            $rootScope.setUser(user);
            $sa($scope, function() {
                $location.search(''); // Clears query params
                $location.path('/todo');
            })
        }, function(error) {
            $sa($scope, function() {
                $scope.signInStatus = {
                    "status": false,
                    "message": "Sign-In with Google failed."
                }
            })
        })
  })
  .run(['$rootScope', '$location',
    function($rootScope, $location) {
      /* Set User on a `$rootScope` */
      $rootScope.setUser = function(user) {
        $rootScope.currentUser = user;
      }

      /* Delete User Information */
      $rootScope.clearUser = function() {
        delete $rootScope.currentUser;
      }

      /* Logout current user and redirect to `/` route */
      $rootScope.logout = function() {
        BuiltApp.User.getCurrentUser()
          .then(function(user) {
            return user.logout();
          })
          .then(function(res) {
            BuiltApp.User.clearSession;
            $sa($rootScope, function() {
              $rootScope.clearUser();
              $location.path('/');
            });
          }, function(err) {
            $sa($rootScope, function() {
              $rootScope.clearUser();
              $location.path('/');
            });
          });
      }

      /*
        Add user to role
      */
      $rootScope.addUserToRole = function(roleUID, userUID){
        //Create a `Role`
        var role      = BuiltApp.Role(roleUID);
        var roleUsers = [];

        /* 
          Fetch all exsisting users uid from role 
        */
        role
         .fetch()
          .then(function(data){
            roleUsers = data.get('users');
            roleUsers.push(userUID);
            /*
              Add the current user uid to Role
            */
            role
              .addUsers(roleUsers)
              .save()
              .then(function(data){
              })
          });
      }

      /*
        If current user is present redirect to `/todo` route
      */
      if(BuiltApp.User.isAuthenticated()){
        BuiltApp.User.getCurrentUser()
          .then(function(data) {
            $sa($rootScope, function() {
              $rootScope.setUser(data);
              $location.path('/todo');
            });
          }, function(error) {
            console.log('Please Login Again.');
          });
      }
    }
  ])

// Safely apply changes
function $sa(scope, fn) {
  (scope.$$phase || scope.$root && scope.$root.$$phase) ? fn() : scope.$apply(fn);
}