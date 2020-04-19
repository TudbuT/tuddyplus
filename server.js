const api = require("apisy");
require("hashcode.js");

//api.db.autosave = 0;

if (!api.db.users) api.db.users = { count: 0 };
if (!api.db.posts) api.db.posts = [];
//api.db.users.TudbuT.msgs = []
//api.db.users.Tuddy.admin = true;
//api.db.users.count = 1;

const genPassword = string => {
  let result = string;
  let saltAmount = Number(
    String(Math.random())
      .split(".")[1]
      .slice(0, 5)
  );

  for (let i = 0; i < saltAmount; i++) {
    result = result.sha256();
  }

  return {
    h: result,
    salted: saltAmount
  };
};

const checkPassword = (password, given) => {
  let result;

  let check = given;
  for (let i = 0; i < password.salted; i++) {
    check = check.sha256();
  }

  if (check === password.h) {
    result = true;
  } else result = false;

  return result;
};

const genToken = user => {
  return `${user.id}/${user.username}_${user.password.h}`.sha256();
};

const getByToken = token => {
  for (let key of Object.keys(api.db.users)) {
    if (key !== "count")
      if (api.db.users[key])
        if (api.db.users[key].token === token) return api.db.users[key];
  }
};

const genPost = user => {
  let post = {
    author: user.username,
    authorID: user.id,
    content: null,
    title: null
  };
  return rPost(post);
};

const rPost = post => {
  post.toHTML = function() {
    return (
      "<post><h4>" +
      this.author +
      " (" +
      this.authorID +
      ")</h4><h5>" +
      this.title +
      "</h5><br/>" +
      this.content
        .split("&")
        .join("&amp;")
        .split("<")
        .join("&lt;")
        .split("\n")
        .join("<br/>") +
      "</post><br/><br/>"
    );
  };
  return post;
};

const getPost = () => {
  let post;
  return (post = rPost(
    api.db.posts[Math.floor(Math.random() * api.db.posts.length)]
  ))
    ? post
    : getPost();
};

const redirect = url => {
  return "<script>window.location.href = '" + url + "'</script>";
};

//GET:

api.get["404"] = () => {
  return api.getFile("404.html");
};

api.get["/"] = () => {
  return api.getFile("index.html");
};

api.get["/login"] = () => {
  return api.getFile("login.html");
};

api.get["/terms"] = () => {
  return api.getFile("tos.html");
};

api.get["/signup"] = r => {
  let token;

  if (api.db.users[r.username]) {
    return api.getFile("signup_error.html");
  } else {
    api.db.users[r.username] = {
      username: r.username,
      id: api.db.users.count,
      password: genPassword(r.password),
      msgs: [],
      admin: false
    };
    api.db.users.count++;
    api.db.users[r.username].token = token = genToken(api.db.users[r.username]);
  }

  return redirect("/user?token=" + token);
};

api.get["/signin"] = r => {
  let token;

  if (api.db.users[r.username]) {
    if (checkPassword(api.db.users[r.username].password, r.password)) {
      token = api.db.users[r.username].token;
      return (
        redirect("/user?token=" + token)
      );
    } else {
      return api.getFile("signin_error.html");
    }
  } else {
    return api.getFile("signin_error.html");
  }
};

api.get["/user"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);
    return api
      .getFile("user.html")
      .split("__TOKEN__")
      .join(r.token)
      .split("__USERNAME__")
      .join(user.username)
      .split("__ADMIN__")
      .join(user.admin ? "1" : "0")
  } else {
    return api.getFile("signin_error.html");
  }
};

api.get["/change/password"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);

    user.password = genPassword(r.password);
    let token = genToken(user);
    user.token = token;

    return redirect("/user?token=" + token);
  } else return api.getFile("signin_error.html");
};

api.get["/change/delete"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);

    let delID = String(Math.random()).split(".")[1];
    for (let post of api.db.posts) {
      if (post.authorID === user.id) {
        post.author = "[DELETED_USER] " + delID;
        post.authorID = -1;
        post.title = "[POST DELETED by `[T+ SYSTEM]`]";
        post.content = "[POST DELETED] Author not existing";
      }
    }

    api.db.users[user.username] = undefined;
    user.username = null;
    user.password = null;
    user.token = null;
    user.id = -1;

    return redirect("/");
  } else return api.getFile("signin_error.html");
};

//POST

api.post["/api/getContent"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);

    //MSGS
    let msgs = "<h3>Your messages</h3><br/><br/>";
    for (let msg of user.msgs) {
      msgs += rPost(msg).toHTML();
    }
    msgs +=
      "<a onclick=\"req('/api/read?token=' + g('token').innerHTML, 'trash')\">All read</a><br/><br/><br/><br/>";

    //POSTS
    let posts = "<h3>Random posts</h3><br/><br/>";
    let gotten = [];
    for (let i = 0; i < 20; i++) {
      let post = getPost();
      if (!gotten.includes(post) && post.title !== null) {
        if (user.admin) {
          posts += `<br/><a onclick="req('/api/delPost?token=' + g('token').innerHTML + '&title=${encodeURIComponent(
            post.title
          )}&text=${encodeURIComponent(
            post.content
          )}&authorID=${encodeURIComponent(
            post.authorID
          )}&author=${encodeURIComponent(
            post.author
          )}', 'trash')">Delete</a><br/>`;
        }
        posts += post.toHTML();
      }
      gotten[gotten.length] = post;
    }
    return msgs + posts;
  }
};

api.post["/api/createPost"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);

    let post = rPost(genPost(user));
    post.title = r.title;
    post.content = r.text;
    api.db.posts[api.db.posts.length] = post;
  }
};

api.post["/api/sendMessage"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);

    let post = rPost(genPost(user));
    post.title = r.title;
    post.content = r.text;
    let dest;
    if ((dest = api.db.users[r.user])) {
      dest.msgs[dest.msgs.length] = post;
    }
  }
};

api.post["/api/read"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);

    user.msgs = [];
  }
};

api.post["/api/delPost"] = r => {
  if (getByToken(r.token)) {
    let user = getByToken(r.token);
    console.log("Deleting post...");
    for (let post of api.db.posts) {
      console.log(
        "Author post: " + post.author + "; " + "Author r: " + r.author
      );

      if (post.author === r.author) {
        console.log("Author: OK...");
        console.log(
          "AuthorID post: " + post.authorID + "; " + "AuthorID r: " + r.authorID
        );

        if (String(post.authorID) === r.authorID) {
          console.log("AuthorID: OK...");
          console.log(
            "Text post: " + post.content + "; " + "Text r: " + r.text
          );

          if (post.content === r.text) {
            console.log("Text: OK...");
            console.log(
              "Title post: " + post.title + "; " + "Title r: " + r.title
            );

            if (post.title === r.title) {
              console.log("Title: OK...");

              if (post.title !== "[POST DELETED by `" + user.username + "`]") {
                post.title = "[POST DELETED by `" + user.username + "`]";
                post.content = "[POST DELETED] Deleted by moderator";
              } else {
                post.title = null;
              }
              console.log("Post deleted!");
            }
          }
        }
      }
    }
  }
};

api.post["/api/addAdmin"] = r => {
  if(getByToken(r.token)) {
    let user = getByToken(r.token);
    
    if(user.admin) {
      if(api.db.users[r.user]) {
        api.db.users[r.user].admin = true;
      }
    }
  }
}

api.post["/api/rmAdmin"] = r => {
  if(getByToken(r.token)) {
    let user = getByToken(r.token);
    
    if(user.admin) {
      if(api.db.users[r.user]) {
        api.db.users[r.user].admin = false;
      }
    }
  }
}
