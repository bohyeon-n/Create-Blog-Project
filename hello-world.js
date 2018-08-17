const hljs = require("highlight.js");

const md = require("markdown-it")({
  html: true,
  linkify: true,
  typograther: true,
  highlight: function(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          `<pre class="hljs block"><code class="html">` +
          hljs.highlight(lang, str, true).value +
          "</code></pre>"
        );
      } catch (__) {}
    }

    return (
      '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + "</code></pre>"
    );
  }
});

//requiring path and fs modules
const path = require("path");
const http = require("http");
const fs = require("fs");
const ejs = require("ejs");
const ejsLint = require("ejs-lint");
//joining path of directory
let directoryPath = path.join(__dirname, "content");
//passsing directoryPath and callback function

const indexHtmlFormat = fs.readFileSync("./public/index.html", "utf8");
const sidebarHtmlFormat = fs.readFileSync("./public/sidebar.html", "utf8");
const listHtmlFormat = fs.readFileSync("./public/list.html", "utf8");
const homeHtmlFormat = fs.readFileSync("./public/home.html", "utf8");
const articleHtmlFormat = fs.readFileSync("./public/article.html", "utf8");
const headerHtmlFormat = fs.readFileSync("./public/header.html", "utf8");

// md파일에서 사용자가 입력한 값 추출하기
function extractedValue(md) {
  // string = md.match(/\n*(\+\+\+)\n*([\s\S]+)\n*(\+\+\+)/);
  string = md.match(/(\+{3})([\s|\S]+?)\1/);

  if (string === null) {
    value = { title: "", date: "", category: "" };
    return value;
  } else {
    str = string[2].match(/[^\r\n]+/g);

    let extractedValue = {};
    str.forEach(value => {
      if (value !== " ") {
        let valueline = value.match(/(.+)[=\n](.+)/);
        if (valueline != null) {
          key = valueline[1].replace(/\s/g, "");

          value = valueline[2].replace(/['"]/g, "");
          extractedValue[key] = value;
        }
      }
    });
    return extractedValue;
  }
}

// md 파일에서 사용자가 입력한 값을 제외한 본문 추출하기
function extractedBody(md) {
  return md.replace(/(\+{3})([\s\S]+?)(\1)/, "");
}
let dir = "./deploy";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// 폴더 만들어주기
dir = "./deploy/category";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// content 안에 있는 directories 읽기
let directories = fs.readdirSync(directoryPath);

let articles = [];
let categoryByfiles = [];

directories.forEach((directory, index) => {
  const fileList = fs.readdirSync(`./content/${directory}`);
  // 파일에서 value 와 body를 변환해서 categoryByfiles에 푸시해줌.
  let files = [];
  fileList.forEach(file => {
    const markdownFile = fs.readFileSync(
      `./content/${directories[index]}/${file}`,
      "utf-8"
    );

    let value = extractedValue(markdownFile);
    let body = md.render(extractedBody(markdownFile));

    let categoryName = value.category.replace(/(\s*)/g, "");
    let folder = value.category.toLocaleLowerCase().replace(/(\s*)/g, "");
    let fileName = (
      file.slice(0, file.indexOf(".")).toLocaleLowerCase() + `.html`
    ).replace(/(\s*)/g, "");
    let front = value.front;
    if (front) {
      console.log(front);
      front = front.replace(/(\s*)/g, "");
      front = /true/i.test(front);
      console.log(front);
    }
    let i = files.findIndex(o => o.categoryName === categoryName);
    let fileObj = {
      fileName,
      folder,
      body,
      value
    };
    if (i < 0) {
      files.push({
        categoryName,
        folder,
        files: [fileObj]
      });
    } else {
      files[i].files.push(fileObj);
    }
    if (front) {
      articles.push(fileObj);
    }
  });
  categoryByfiles.push(...files);
});

// 컴포넌트, 파일 만들기
// articles : 모든 post를 모아 놓음 [{value: ..., body:..., fileName: ...html}]형식임
// categoryByfiles : 카테고리 별로 post를 모아 놓음 [{categoryName:..., folder, files:[{value:..., body: ..., fileName:...,folder: ...}, {}, {}, {}]}, {category2}...]
// 사용자 정보 읽기
const author = fs.readFileSync("./author/author.md", "utf8");
const authorValue = extractedValue(author);

// header
const header = ejs.render(headerHtmlFormat, {
  author: authorValue,
  categories: categoryByfiles
});
// sidebar
const sidebar = ejs.render(sidebarHtmlFormat, {
  categories: categoryByfiles
});
const authorMain = md.render(extractedBody(author));
const authorHtml = ejs.render(indexHtmlFormat, {
  header,
  sidebar,
  main: authorMain
});
dir = `./deploy/author`;
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}
fs.writeFileSync("./deploy/author/author.html", authorHtml);
//
categoryByfiles.forEach(category => {
  // category page 생성

  if (category.folder !== undefined) {
    let dir = `./deploy/${category.folder}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
  // category별로 file의 리스트를 보여주는 category 페이지 생성
  // files 최신순으로 정렬
  const orderedFiles = category.files.sort((a, b) => {
    return parseInt(b.value.date, 10) - parseInt(a.value.date, 10);
  });
  const main = ejs.render(listHtmlFormat, {
    files: orderedFiles,
    category: category.categoryName,
    folder: category.folder
  });
  const indexHtml = ejs.render(indexHtmlFormat, {
    header: header,
    main: main,
    sidebar: sidebar
  });

  fs.writeFileSync(`./deploy/category/${category.folder}.html`, indexHtml);
  // 파일 별로 article page를 생성
  category.files.forEach(file => {
    const path = `http://bohyeon-n.github.io/deploy/${category.folder}/${
      file.fileName
    }`;

    const article = ejs.render(articleHtmlFormat, {
      body: file.body,
      value: file.value,
      path: path
    });
    const html = ejs.render(indexHtmlFormat, {
      main: article,
      sidebar: sidebar,
      header: header
    });
    fs.writeFileSync(`./deploy/${category.folder}/${file.fileName}`, html);
  });
});

//홈화면 생성

articles = articles.sort((a, b) => {
  return parseInt(b.value.date, 10) - parseInt(a.value.date, 10);
});

main = ejs.render(homeHtmlFormat, {
  articles: articles
});
html = ejs.render(indexHtmlFormat, {
  main,
  sidebar,
  header
});

fs.writeFileSync("./index.html", html);
