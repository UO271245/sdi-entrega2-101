module.exports = function (app, usersRepository, amistadesRepository, peticionesRepository) {

    let logger = app.get("log4js")

    /**
     * Método get para la página de inicio de la aplicación
     */
    app.get('/home', function (req, res) {
        logger.info("GET /home");
        let user = req.session.user
        if (user == undefined) {
            user.name = 'ANONIMO'
            user.rol = 'ANONIMO'
        }
        res.render("home.twig", {user: user, userInSession: req.session.user});//

    });
    /**
     * Método get para el registro en la aplicación
     */
    app.get('/signup', function (req, res) {
        logger.info("GET /users/signup");
        res.render("users/signup.twig");
    });
    /**
     * Método get para el inicio de sesión en la aplicación
     */
    app.get('/login', function (req, res) {
        logger.info("GET /users/login");
        res.render("users/login.twig", {userInSession: req.session.user});
    });
    /**
     * Método get que devuelve una lista de usuarios
     */
    app.get('/users', function (req, res) {
        logger.info("GET /users");
        let filter = {};
        filter = {
            email: {$ne: req.session.user.email},
            rol: {$ne: "ADMIN"}
        }
        if (req.query.search != null && typeof (req.query.search) != "undefined" &&
            req.query.search != "") {
            filter = {
                "$or": [
                    {"name": {$regex: ".*" + req.query.search + ".*"}},
                    {"surname": {$regex: ".*" + req.query.search + ".*"}},
                    {"email": {$regex: ".*" + req.query.search + ".*"}}
                ]
            };
        }

        let page = parseInt(req.query.page);
        if (typeof req.query.page === "undefined" || req.query.page === null || req.query.page === "0") {
            page = 1;
        }
        usersRepository.getUsersPage(filter, {}, page, 4).then(result => {
            // usersRepository.findUsers(filter, {}).then(result => {
            let lastPage = result.total / 4;
            if (result.total % 4 > 0) {
                lastPage++;
            }
            let pages = [];
            for (let i = page - 2; i <= page + 2; i++) {
                if (i > 0 && i <= lastPage) {
                    pages.push(i);
                }
            }
            usersRepository.findUsers(filter, {}).then(users => {
                /*let filter2 = {
                    email : req.session.user.email,
                }*/
                //usersRepository.findUser(filter2, {}).then(user=>{
                if (users == null || users.length === 0) {
                    logger.error("GET /users => Usuario no identificado");
                    res.redirect("/users/login" + "?message=Usuario no identificado" + "&messageType=alert-danger ");

                } else {
                    let roleUserSession = req.session.user.rol;
                    if (roleUserSession === "ADMIN") {
                        res.render("users/list.twig",
                            {
                                users: users,
                                user: req.session.user,
                                pages: pages,
                                currentPage: page,
                                userRol: roleUserSession
                                , userInSession: req.session.user
                            });
                    } else {
                        for (i = 0; i < result.users.length; i++) {
                            if (result.users[i].email === req.session.user.email || result.users[i].email === "admin@email.com") {
                                result.users.splice(i, 1);
                                i--;
                            }
                        }
                        renderUserList(req, res, req.session.user, result.users, pages, page);

                    }
                }
            }).catch(err => {
                logger.error("Se ha producido un error al buscar los usuarios");
                res.render("error.twig", {
                    mensaje: "Se ha producido un error al buscar los usuarios",
                    elError: err, userInSession: req.session.user
                });
            });
        }).catch(err => {
            logger.error("Se ha producido un error al buscar los usuarios");
            res.render("error.twig", {
                mensaje: "Se ha producido un error al buscar los usuarios",
                elError: err, userInSession: req.session.user
            });
        });
    })

    /**
     * Método auxiliar que pone el botón de enviar petición de amistad solo a los no amigos
     * @param req
     * @param res
     * @param user
     * @param users
     * @param pages
     * @param page
     */
    function renderUserList(req, res, user, users, pages, page) {
        let filter = {
            rol: 'USER',
            email: {$ne: req.session.user.email}
        };
        let options = {};
        if (users == null) {
            //algun error
        } else {
            amistadesRepository.findAmistadesByEmail({$or: [{user1: req.session.user.email}, {user2: req.session.user.email}]}, {}).then(amistades => {
                peticionesRepository.findPeticionesByEmail({user1: req.session.user.email}, {}).then(peticiones => {
                    let emailsAmistades = getEmailFromList(amistades, req);
                    let emailsPeticiones = getEmailFromList(peticiones, req);
                    res.render("users/list.twig", {
                        users: users,
                        emailsAmistades: emailsAmistades,
                        emailsPeticiones: emailsPeticiones,
                        pages: pages,
                        currentPage: page,
                        userRol: user.rol,
                        user: user, userInSession: req.session.user
                    });
                }).catch(error => {
                    logger.error("Se ha producido un error al buscar las peticiones");
                    res.render("error.twig", {
                        mensaje: "Se ha producido un error al buscar las peticiones",
                        elError: error, userInSession: req.session.user
                    });
                });
            }).catch(error => {
                logger.error("Sucedió un error buscando las amistades");
                res.render("error.twig", {
                    mensaje: "Sucedió un error buscando las amistades",
                    elError: error, userInSession: req.session.user
                });
            });


        }
    }
    /**
     * Método post para borrar a uno o multiples usuarios
     */
    app.post("/users/delete", function (req, res) {
        logger.info("POST /users/delete");
        let toDeleteUsers = req.body.checkEliminar;
        if (!Array.isArray(toDeleteUsers)) {
            let aux = toDeleteUsers;
            toDeleteUsers = [];
            toDeleteUsers.push(aux);
        }
        let filter = {email: {$in: toDeleteUsers}};
        let filter2 = {$or: [{"user1": {$in: toDeleteUsers}}, {"user2": {$in: toDeleteUsers}}]};
        peticionesRepository.deletePeticiones(filter2, {}).then(peticion => {
            if (peticion == null) {
                res.redirect("/users" + "?message=Se ha producido un error al eliminar envitaciones" + "&messageType=alert-danger");
            } else {
                amistadesRepository.deleteAmistades(filter2, {}).then(amistades => {
                    if (amistades == null) {
                        res.redirect("/users" + "?message=Se ha producido un error al eliminar los amigos" + "&messageType=alert-danger");
                    } else {
                        usersRepository.deleteUsers(filter, {}).then(users => {
                            res.redirect("/users");
                        }).catch(error => {
                            logger.error("Se ha producido un error al listar los usuarios del sistema");
                            res.render("error.twig", {
                                mensaje: "Se ha producido un error al listar los usuarios del sistema",
                                elError: error, userInSession: req.session.user
                            });
                        });
                    }
                }).catch(error => {
                    logger.error("Se ha producido un error al eliminar los amigos");
                    res.render("error.twig", {
                        mensaje: "Se ha producido un error al eliminar los amigos",
                        elError: error, userInSession: req.session.user
                    });
                });
            }
        }).catch(error => {
            logger.error("Se ha producido un error al eliminar las invitaciones del sistema");
            res.render("error.twig", {
                mensaje: "Se ha producido un error al eliminar las invitaciones del sistema",
                elError: error, userInSession: req.session.user
            });
        });
    })
    /**
     * Método post para el registro en la aplicación
     */
    app.post('/signup', function (req, res) {
        logger.info("POST /signup");

        if (req.body.password != req.body.passwordConfirm) {
            res.redirect("/signup" +
                "?message=La contraseña no se ha repetido correctamente" +
                "&messageType=alert-danger ");
            // logger.error("El usuario que va a registrarse ha introducido mal su contraseña");
        } else {
            let securePassword = app.get("crypto")
                .createHmac('sha256', app.get('clave'))
                .update(req.body.password).digest('hex');
            let user = {
                email: req.body.email,
                password: securePassword,
                name: req.body.name,
                surname: req.body.surname,
                rol: "USER"
            }

            let filter = {email: user.email}
            usersRepository.findUser(filter, {}).then(userFound => {
                if (userFound == null) {
                    //si no hay ninguno se puede registrar
                    usersRepository.insertUser(user).then(userId => {
                        //res.send('Usuario registrado ' + userId);
                        res.render("home.twig", {user: user});
                    }).catch(err => {
                        logger.error("Error al insertar el usuario");
                        res.render("error.twig", {
                            mensaje: "Error al insertar el usuario",
                            elError: error, userInSession: req.session.user
                        });
                    });
                } else {
                    //Si ya hay un email en la BDD lanzamos el error
                    logger.error("Ya existe un usuario registrado con ese email");
                    res.redirect("/signup" +
                        "?message=Ya existe un usuario registrado con ese email" +
                        "&messageType=alert-danger ");
                }
            }).catch(err => {
                logger.error("Error al insertar el usuario");
                res.render("error.twig", {
                    mensaje: "Error al insertar el usuario",
                    elError: error, userInSession: req.session.user
                });
            });
        }

    });

    /**
     * Método post para el inicio de sesión en la aplicación
     */
    app.post('/login', function (req, res) {
        logger.info("POST /login");
        let securePassword = app.get("crypto").createHmac('sha256', app.get('clave'))
            .update(req.body.password).digest('hex');
        let filter = {
            email: req.body.email,
            password: securePassword
        }
        let options = {};

        usersRepository.findUser(filter, {}).then(user => {

            if (user == null) {
                req.session.user = null;
                res.redirect("/login" +
                    "?message=Email o password incorrecto" +
                    "&messageType=alert-danger ");
            } else {
                req.session.user = user;
                res.redirect("/users");
            }
        }).catch(err => {
            logger.error("Se ha producido un error al buscar el usuario");
            req.session.user = null;
            res.redirect("/login" +
                "?message=Se ha producido un error al buscar el usuario" +
                "&messageType=alert-danger ");
        });
    });
    /**
     * Método get para la salida de sesión en la aplicación
     */
    app.get('/logout', function (req, res) {
        logger.info("GET /login");
        req.session.user = null;
        res.render("index.twig", {userInSession: req.session.user});
    });

    function getEmailFromList(list, req) {
        let resultList = [];
        for (let i = 0; i < list.length; i++) {
            if (list[i].user1 === req.session.user.email) {
                resultList.push(list[i].user2);
            } else {
                resultList.push(list[i].user1);
            }
        }
        return resultList;
    }


}
