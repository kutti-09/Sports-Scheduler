const express = require("express");
const app = express();
const { Todo, User, Sports, sessions, players } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
const passport = require("passport");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "images")));
app.set("view engine", "ejs");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
var csurf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");

const saltRounds = 10;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! some secret string"));
app.use(csurf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
app.use(flash());
app.use(
    session({
        secret: "my-super-secret-key-21728172615261562",
        cookie: {
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());
app.use((request, response, next) => {
    response.locals.messages = request.flash();
    next();
});

passport.use(new LocalStrategy({
    usernameField: "email",
    passwordField: "password",
}, (username, password, done) => {
    User.findOne({
        where: {
            email: username,
        },
    }).then(async (user) => {
        const result = await bcrypt.compare(password, user.password);
        if (result) {
            return done(null, user);
        } else {
            return done(null, false, { message: "Invalid Password" });
        }
    }).catch((error) => {
        return done(null, false, {
            message: "Account doesn't exist for this mail id",
        });
    });
}));

passport.serializeUser((user, done) => {
    console.log("Serializing user in session", user.id);
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findByPk(id)
        .then((user) => {
            done(null, user);
        }).catch((error) => {
            done(error, null);
        });
});

app.get("/", async (request, response) => {
    response.render("index", {
        title: "Sports-Scheduler",
        "csrfToken": request.csrfToken(),
    });
});

app.get("/Signup_Page", (request, response) => {
    response.render("Signup_Page", {
        title: "Signup",
        csrfToken: request.csrfToken()
    });
});

app.get("/Login_Page", (request, response) => {
    response.render("Login_Page", {
        title: "Login",
        "csrfToken": request.csrfToken(),
    });
});

app.get("/signout", (request, response) => {
    request.logout((err) => {
        if (err) {
            return next(err);
        }
        response.redirect("/");
    });
});

app.post("/users", async (request, response) => {
    const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
    console.log(hashedPwd);
    const existingUser = await User.findOne({
        where: {
            email: request.body.email,
        },
    });
    console.log(existingUser);
    if (existingUser) {
        request.flash("error", "Email already in use!");
        response.redirect("/Signup_Page");
    }
    else {
        try {
            const user = await User.create({
                firstName: request.body.firstName,
                lastName: request.body.lastName,
                email: request.body.email,
                password: hashedPwd,
            });
            request.login(user, (err) => {
                if (err) {
                    console.log(error);
                }
                return response.redirect("/User_Home_Page/n");
            });
        } catch (error) {
            console.log(error);
        }
    }
});

app.post("/session", passport.authenticate("local", {
    failureRedirect: "/Login_Page",
    failureFlash: true,
}),
    async (request, response) => {
        console.log(request.user);
        if (
            request.body.email === "administrator@gmail.com" &&
            request.body.password === "admin9876"
        ) {
            return response.redirect("/admin");
        }
        return response.redirect(`/User_Home_Page/n`);
    }
);

app.get("/User_Home_Page/n", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const getUserName = await User.findOne({
            where: {
                id: request.user.id,
            },
        });
        console.log(request.user.id);
        console.log(getUserName.firstName);
        const sportsItems = await Sports.findAll();
        if (request.accepts("html")) {
            response.render("User_Home_Page", {
                sportsItems: sportsItems,
                csrfToken: request.csrfToken(),
                getUserName,
            });
        }
    }
);

app.get("/admin", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const getUserName = await User.findOne({
            where: {
                id: request.user.id,
            },
        });
        const sportsItems = await Sports.findAll();
        const sportsItemsUser = await Sports.findOne();
        if (request.accepts("html")) {
            response.render("Admin_Home_Page", {
                sportsItems: sportsItems,
                "csrfToken": request.csrfToken(),
                user: sportsItemsUser,
                getUserName,
            });
        }
    }
);

app.get("/sportsCreation", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        return response.render("sportsCreation", {
            "csrfToken": request.csrfToken(),
        });
    }
);

app.get("/View_Report", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const countOfSports = await Sports.count();
        const getSports = await Sports.findAll();
        const getSessions = await sessions.findAll();
        console.log(countOfSports);
        return response.render("View_Report", {
            "csrfToken": request.csrfToken(),
            countOfSports,
            getSports,
            getSessions,
        });
    }
);

app.post("/newsport", async (request, response) => {
    const inputFieldNewSport = request.body.Sports_Name;
    const existingSport = await Sports.findOne({
        where: { Sports_Name: inputFieldNewSport },
    });
    if (existingSport) {
        request.flash("error", "Already Exist in the database");
        return response.redirect("/admin");
    } else {
        try {
            const inputData = await Sports.create({
                Sports_Name: inputFieldNewSport,
            });
            console.log(inputData);
            return response.redirect("/admin");
        } catch (error) {
            console.log(error);
        }
    }
});

app.get("/newsport", async (request, response) => {
    const getSingleSport = await Sports.findOne({
        where: {
            Sports_Name: "Check",
        },
    });
    try {
        return response.render("Sport_Detail_Page", {
            getSingleSport,
            name: getSingleSport.Sports_Name,
        });
    } catch (error) {
        console.log(error);
    }
});

app.get("/join/n/:sportname/:sessionId", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const getPlayerName = await User.findOne({
            where: {
                id: request.user.id,
            },
        });
        console.log(getPlayerName.firstName);
        const totalPlayers = await sessions.findOne({
            where: {
                id: request.params.sessionId,
            },
        });
        const num = 1;
        const countOfPlayers = await players.count({
            where: {
                sessionId: request.params.sessionId,
            },
        });
        const existingPlayer = await players.findOne({
            where: {
                playerAccessId: request.user.id,
                sportmatch: request.params.sportname,
                sessionId: request.params.sessionId,
            },
        });
        if (existingPlayer) {
            request.flash("error", "Already joined");
            return response.redirect(
                `/Sports/${request.params.sportname}/SessionDetail/n/${request.params.sessionId}`
            );
        } else {
            const joinPlayer = await players.create({
                playerNames: getPlayerName.firstName,
                sessionId: request.params.sessionId,
                sportmatch: request.params.sportname,
                playerAccessId: request.user.id,
            });
        }
        const updateAvailablePlayer = await sessions.update(
            {
                availablePlayers: totalPlayers.countOfPlayers - (countOfPlayers + num),
            },
            {
                where: {
                    id: request.params.sessionId,
                },
            }
        );
        return response.redirect(
            `/Sports/${request.params.sportname}/SessionDetail/n/${request.params.sessionId}`
        );
    }
);

app.get("/join/:sportname/:sessionId", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const getPlayerName = await User.findOne({
            where: {
                id: request.user.id,
            },
        });
        console.log(getPlayerName.firstName);
        const totalPlayers = await sessions.findOne({
            where: {
                id: request.params.sessionId,
            },
        });
        const num = 1;
        const countOfPlayers = await players.count({
            where: {
                sessionId: request.params.sessionId,
            },
        });
        const existingPlayer = await players.findOne({
            where: {
                playerAccessId: request.user.id,
                sportmatch: request.params.sportname,
                sessionId: request.params.sessionId,
            },
        });
        if (existingPlayer) {
            request.flash("error", "Already joined");
            return response.redirect(
                `/Sports/${request.params.sportname}/SessionDetail/${request.params.sessionId}`
            );
        } else {
            const joinPlayer = await players.create({
                playerNames: getPlayerName.firstName,
                sessionId: request.params.sessionId,
                sportmatch: request.params.sportname,
                playerAccessId: request.user.id,
            });
        }
        const updateAvailablePlayer = await sessions.update(
            {
                availablePlayers: totalPlayers.countOfPlayers - (countOfPlayers + num),
            },
            {
                where: {
                    id: request.params.sessionId,
                },
            }
        );
        return response.redirect(
            `/Sports/${request.params.sportname}/SessionDetail/${request.params.sessionId}`
        );
    }
);

app.post("/updateSession", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const updateSession = await sessions.update(
            {
                session: request.body.session,
                time: request.body.time,
                Address: request.body.Address,
                countOfPlayers: request.body.numberOfPlayers,
            },
            {
                where: {
                    id: request.body.userId,
                },
            }
        );
        return response.redirect(`/admin`);
    }
);

app.post("/updateSession/n", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const updateSession = await sessions.update(
            {
                session: request.body.session,
                time: request.body.time,
                Address: request.body.Address,
                countOfPlayers: request.body.numberOfPlayers,
            },
            {
                where: {
                    id: request.body.userId,
                },
            }
        );
        return response.redirect(`/User_Home_Page/n`);
    }
);

app.post("/updateSport", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const oldSportName = request.body.Check_Sports_Name;
        const newSportName = request.body.Sports_Name_Update;
        const updateSport = await Sports.update(
            { Sports_Name: newSportName },
            {
                where: {
                    Sports_Name: oldSportName,
                },
            }
        );
        const updateSessionSportName = await sessions.update(
            { sportname: newSportName },
            {
                where: {
                    sportname: oldSportName,
                },
            }
        );
        return response.redirect("/admin");
    }
);

app.get("/Sports/:name/NewSession", async (request, response) => {
    return response.render("sessionCreation", {
        title: request.params.name,
        "csrfToken": request.csrfToken(),
    });
});

app.get("/Sports/:name/deleteSession/:id", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const deleteSessionId = request.params.id;
        const nameofSport = request.params.name;

        const deletePlayer = await sessions.destroy({
            where: {
                id: deleteSessionId,
            },
        });

        await players.destroy({
            where: {
                playerAccessId: request.user.id,
            },
        });

        return response.redirect(`/Sports/${encodeURIComponent(nameofSport.trim())}`);
    }
);

app.get("/Sports/:name/deleteSession/n/:id", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const deleteSessionId = request.params.id;
        const nameofSport = request.params.name;

        const deletePlayer = await sessions.destroy({
            where: {
                id: deleteSessionId,
            },
        });

        await players.destroy({
            where: {
                playerAccessId: request.user.id,
            },
        });

        return response.redirect(`/Sports/n/${encodeURIComponent(nameofSport.trim())}`);
    }
);

app.get("/Sports/:name/sessionDetail/delete/:id/sessionid/:sessionid", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const deletePlayerId = request.params.id;
        const nameofSport = request.params.name;
        const sessionId = request.params.sessionid;
        const deletePlayer = await players.destroy({
            where: {
                id: deletePlayerId,
            },
        });
        const countOfPlayers = await players.count({
            where: {
                sessionId: sessionId,
            },
        });
        const totalPlayers = await sessions.findOne({
            where: {
                id: sessionId,
            },
        });
        const updateAvailablePlayer = await sessions.update(
            {
                availablePlayers: totalPlayers.countOfPlayers - countOfPlayers,
            },
            {
                where: {
                    id: sessionId,
                },
            }
        );
        return response.redirect(
            `/Sports/${nameofSport}/sessionDetail/${sessionId}`
        );
    }
);

app.get("/Sports/:name/sessionDetail/delete/:id/sessionid/n/:sessionid", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const deletePlayerId = request.params.id;
        const nameofSport = request.params.name;
        const sessionId = request.params.sessionid;
        const deletePlayer = await players.destroy({
            where: {
                id: deletePlayerId,
            },
        });
        const countOfPlayers = await players.count({
            where: {
                sessionId: sessionId,
            },
        });
        const totalPlayers = await sessions.findOne({
            where: {
                id: sessionId,
            },
        });
        const updateAvailablePlayer = await sessions.update(
            {
                availablePlayers: totalPlayers.countOfPlayers - countOfPlayers,
            },
            {
                where: {
                    id: sessionId,
                },
            }
        );
        return response.redirect(
            `/Sports/${nameofSport}/sessionDetail/n/${sessionId}`
        );
    }
);

app.post("/Sports/:name/sessionDetail/:id", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const sportName = request.params.name;
        const sportId = request.params.id;
        const playerName = request.body.playerNames;
        const create = await players.create({
            playerNames: playerName,
            sportmatch: sportName,
            sessionId: sportId,
        });
        const updateSessionPlayerCount = await sessions.update(
            {
                availablePlayers: request.body.availablePlayersCount,
            },
            {
                where: {
                    id: sportId,
                },
            }
        );
        return response.redirect(`/Sports/${sportName}/sessionDetail/${sportId}`);
    }
);

app.post("/Sports/:name/sessionDetail/n/:id", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const sportName = request.params.name;
        const sportId = request.params.id;
        const playerName = request.body.playerNames;
        const create = await players.create({
            playerNames: playerName,
            sportmatch: sportName,
            sessionId: sportId,
        });
        const updateSessionPlayerCount = await sessions.update(
            {
                availablePlayers: request.body.availablePlayersCount,
            },
            {
                where: {
                    id: sportId,
                },
            }
        );
        return response.redirect(`/Sports/${sportName}/sessionDetail/n/${sportId}`);
    }
);

app.get("/Sports/:name/sessionDetail/:id", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const userId = request.user.id;
        const sessionSportName = request.params.name;
        const sessionSportId = request.params.id;
        const getSessionDetail = await sessions.findOne({
            where: {
                id: sessionSportId,
            },
        });
        const getPlayers = await players.findAll({
            where: {
                sessionId: sessionSportId,
                sportmatch: sessionSportName,
            },
        });
        const getUserWithId = await players.findOne({
            where: {
                playerAccessId: userId,
            },
        });
        const getPlayersCount = await players.count({
            where: {
                sessionId: sessionSportId,
                sportmatch: sessionSportName,
            },
        });
        const getDate = new Date().toISOString();
        console.log(request.user.id);
        response.render("Session_Detail_Page", {
            "csrfToken": request.csrfToken(),
            sessionSportName,
            sessionSportId,
            getSessionDetail,
            getPlayers,
            getPlayersCount,
            userId,
            getUserWithId,
            getDate,
        });
    }
);

app.get("/Sports/:name/sessionDetail/n/:id", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const sessionSportName = request.params.name;
        const sessionSportId = request.params.id;
        const UserId = request.user.id;
        const getSessionDetail = await sessions.findOne({
            where: {
                id: sessionSportId,
            },
        });
        const getPlayers = await players.findAll({
            where: {
                sessionId: sessionSportId,
                sportmatch: sessionSportName,
            },
        });

        const getJoinedPlayer = await players.findOne({
            where: {
                playerAccessId: UserId,
            },
        });

        const getPlayersCount = await players.count({
            where: {
                sessionId: sessionSportId,
                sportmatch: sessionSportName,
            },
        });

        const getUserName = await User.findOne({
            where: {
                id: request.user.id,
            },
        });
        const getUserWithId = await players.findOne({
            where: {
                playerAccessId: UserId,
            },
        });
        console.log(getUserName.firstName);
        response.render("Usersession_Detail_Page", {
            "csrfToken": request.csrfToken(),
            sessionSportName,
            sessionSportId,
            getSessionDetail,
            getPlayers,
            getPlayersCount,
            UserId,
            getUserName,
            getUserWithId,
            getJoinedPlayer,
        });
    }
);

app.get("/SportDetail", connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        return response.render("sportDetailPage2");
    }
);

app.get(`/delete/:id`, connectEnsureLogin.ensureLoggedIn(),
    async (request, response) => {
        const idSport = await Sports.findByPk(request.params.id);
        const sportsItems = await Sports.findAll();
        try {
            console.log(idSport.Sports_Name);
            await sessions.destroy({
                where: {
                    sportname: idSport.Sports_Name,
                },
            });
            await Sports.destroy({
                where: {
                    id: request.params.id,
                },
            });
            return response.redirect("/admin");
        } catch (error) {
            console.log(error);
        }
    }
);

app.get("/Sports/:name", connectEnsureLogin.ensureLoggedIn(),
    async function (request, response) {
        const SportsName = request.params.name;
        const getSportName = await sessions.getSport(SportsName);
        const getDate = new Date().toISOString();
        const playersCount = await players.findAll({
            where: {
                sportmatch: request.params.name,
            },
        });
        const UserId = request.user.id;
        console.log(request.user.id);
        console.log(getSportName);
        return response.render("Sport_Detail_Page", {
            name: SportsName,
            "csrfToken": request.csrfToken(),
            getSportName,
            getDate,
            UserId,
            playersCount,
        });
    }
);

app.get("/Sports/n/:name", connectEnsureLogin.ensureLoggedIn(),
    async function (request, response) {
        const SportsName = request.params.name;
        const getSportName = await sessions.getSport(SportsName);
        const getDate = new Date().toISOString();
        const UserId = request.user.id;
        const getUserName = await User.findOne({
            where: {
                id: request.user.id,
            },
        });
        console.log(request.user.id);
        console.log(getSportName);
        return response.render("Usersport_Detail_Page", {
            name: SportsName,
            "csrfToken": request.csrfToken(),
            getSportName,
            getUserName,
            getDate,
            UserId,
        });
    }
);

app.post("/Sports/:name", async (request, response) => {
    const Date = request.body.session;
    const name = request.params.name;
    const time = request.body.time;
    const address = request.body.Address;
    const playersCount = request.body.numberOfPlayers;
    const availablePlayers = request.body.numberOfPlayers;
    const userId = request.body.userId;
    try {
        const inputData = await sessions.create({
            sportname: request.params.name,
            session: Date,
            time: time,
            Address: address,
            countOfPlayers: playersCount,
            userId: userId,
            availablePlayers: availablePlayers,
        });
        const PlayersName = await players.create({
            playerNames: request.body.players,
            sportname: name,
        });
        console.log(inputData);
        console.log(PlayersName);
        return response.redirect(`/Sports/${name}`);
    } catch (error) {
        console.log(error);
    }
});

app.post("/Sports/n/:name", async (request, response) => {
    const Date = request.body.session;
    const name = request.params.name;
    const time = request.body.time;
    const address = request.body.Address;
    const playersCount = request.body.numberOfPlayers;
    const availablePlayers = request.body.numberOfPlayers;
    const userId = request.body.userId;
    try {
        const inputData = await sessions.create({
            sportname: request.params.name,
            session: Date,
            time: time,
            Address: address,
            countOfPlayers: playersCount,
            userId: userId,
            availablePlayers: availablePlayers,
        });
        const PlayersName = await players.create({
            playerNames: request.body.players,
            sportname: name,
        });
        console.log(inputData);
        return response.redirect(`/Sports/n/${name}`);
    } catch (error) {
        console.log(error);
    }
});


module.exports = app;
