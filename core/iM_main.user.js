// ==UserScript==
// @name         VGTU - Professorin
// @version      0.3
// @description  Table with ALL students, Exam and Labs grades automation, Core comparer
// @author       mrNull
// @match        http://acm.vgtu.lt/*
// @match        https://rep.vgtu.lt/*
// @match        https://mano.vilniustech.lt/lecturercourses/site?*
// @match        https://mano.vilniustech.lt/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=vgtu.lt
// @updateURL    https://github.com/eman-on/VGTUProfessoring/raw/main/core/iM_main.user.js
// @downloadURL  https://github.com/eman-on/VGTUProfessoring/raw/main/core/iM_main.user.js
// @updateURL    https://github.com/eman-on/VGTUProfessoring/raw/main/core/iM_main.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        unsafeWindow
// ==/UserScript==

/**
 * Update Notes:
 * Qualify/Disqualify API integrated
 * iRunner comparer for exam tasks implemented (move,warning,skip)
 * Comparer selection popup
 * Move function (prev/next student) in comparer reworked
 * Settings for comparers are added - skip disqualifyed tasks, increment right window
 */

const checkUrl = 'https://raw.githubusercontent.com/eman-on/VGTUProfessoring/main/core/iM_main.user.js';
const scriptUrl = 'https://github.com/eman-on/VGTUProfessoring/raw/main/core/iM_main.user.js';

(async function init() {
  'use strict';
  /* Specify minimal required grade to get access to the exam */
  // Checks for updates
  const updateCheck = true;
  const minGrade = 5;
  const Core = CORE();
  var storage = null;

  /* Run code on different pages, where:
     key - is url,
     value - function to run */
  allPages();
  const pages = {
    'proff': createProfPage,
    '/contests(.*)standings/': examPage,
    '/contests(.*)solutions/': examComparer
  };

  const currentPageURL = unsafeWindow.location.pathname;
  Object.keys(pages).forEach(key => {
    if ('/' + key == currentPageURL) {
      pages[key]();
    }
    else if (currentPageURL.match(key)) {
      pages[key]();
    }
  })

  /* ================== PAGES =================== */

  /* === This code runs on ALL PAGES === */
  function allPages() {
    /* Change main page style */
    const menuStyle = `
    nav>.container{
      margin-left: 0 !important;
      margin-right: 0 !important;
      width: 100% !important;
    }
    .noCore_popup{
      position: fixed;
      right: 16px;
      bottom: 16px;
      background: #ebebeb;
      border: 1px solid #0572ce;
      box-shadow: 5px 3px 9px 0px gray;
      border-radius: 3px 3px 0px 0px;
      transition: 0.4s;
      animation: moveUp;
      animation-duration: 0.4s;
      animation-fill-mode: forwards;
      max-width: 300px;
      z-index: 100;
    }
    @keyframes moveUp {
      from {bottom: -300px;}
      to {bottom: 16px;}
    }
    .noCore_popup>p{
      padding: 5px;
      margin: 0px;
      font-size: 14px;
      padding-left: 10px;
      padding-right: 10px;
      white-space: pre-line;
    }
    .noCore_popup button{
      display: block;
      margin-left: auto;
    }
    .noCore_popup .buttons{
      display: flex;
      justify-content: space-around;
      padding-bottom: 8px;
      padding-left: 2px;
      padding-right: 2px;
    }
    .noCore_popup .buttons>button{
      margin:0;
      margin-left: 2px;
      margin-right: 2px;
    }
    .noCore_popup:before{
      content: 'Information';
      position: relative;
      display: block;
      text-align: center;
      background: #0572ce;
      padding: 4px;
      color: white;
      font-size: 14px;
    }
    .noCore_popup.warn,.noCore_popup.warning{
      border: 1px solid #ce7f05;
    }
    .noCore_popup.warn:before,.noCore_popup.warning:before{
      background: #ce7f05;
    }

    .noCore_help{
     position: fixed;
     background: #00abff;
     width: 22px;
     height: 22px;
     bottom: 5px;
     right: 5px;
     border-radius: 50%;
     border: 1px solid gray;
     opacity: 0.4;
     transition:0.3s;
     display: flex;
     justify-content: center;
     align-items: center;
     cursor: pointer;
     z-index: 1;
    }
    .noCore_help:hover{
     opacity: 0.9;
     scale: 1.4;
    }
    `;
    Core.style.addStyle('menuStyle', menuStyle);
    /* Create Proffessor button */
    Core.menu.createButton('Professoring', 'proff');

    /* Exam Comparer helper */
    if (window.self !== window.top) {
      initExamComparer_helper();
    }
  }

  /* === This code runs on PROF PAGE === */
  async function createProfPage() {
    document.title = "Professoring — iRunner 2";
    /* Remove 404 error */
    var error404 = document.getElementById('ir_container');
    if (error404) {
      error404.parentNode.removeChild(error404);
    }

    var requiredForUpdateURLs = [];
    var cources = { years: [] }; storage = cources;
    getYearsGroups();

    async function getYearsGroups() {
      /* Get All curses holded by me */
      var page = await Core.page.getPage('http://acm.vgtu.lt/courses/my');
      var years = page.querySelectorAll('.panel>.panel-heading');
      //var courcesAll = [...page.querySelectorAll('*:first-of-type>.panel table>tbody>tr>td:first-of-type>a')];

      years.forEach((y) => {
        var year = y.innerText.replace(/\n| /g, '');
        cources.years.push(year);
        getAllCurces(year, [...y.parentNode.querySelectorAll('table>tbody>tr>td:first-of-type>a')]);
      });
      /* For each cource get students */
      function getAllCurces(year1, courcesAll) {
        courcesAll.forEach(function (cource) {
          var year = cource.innerText.split(', ')[1];
          if (!cources[year]) {
            cources[year] = { groups: [] };
            Object.defineProperty(cources[year], "parent", { enumerable: false, value: cources });
          }
          var groupAndLab = cource.innerText.split(', ')[0];
          var group = groupAndLab.slice(0, groupAndLab.indexOf(' '));
          if (!cources[year][group]) { cources[year][group] = { labs: [], exam: { allowed: {}, alloweduid: {} } }; Object.defineProperty(cources[year][group], "parent", { enumerable: false, value: cources[year] }); cources[year].groups.push(group); }
          var lab = groupAndLab.split(' ')[1];
          if (!cources[year][group][lab]) { cources[year][group][lab] = {}; Object.defineProperty(cources[year][group][lab], "parent", { enumerable: false, value: cources[year][group] }); cources[year][group].labs.push(lab) }
          cources[year][group][lab].url = cource.getAttribute('href') + 'standings/';
          cources[year][group][lab].year = year;
          cources[year][group][lab].group = group;
          cources[year][group][lab].lab = lab;
          cources[year][group][lab].students = {};
          Object.defineProperty(cources[year][group][lab].students, "parent", { enumerable: false, value: cources[year][group][lab] });
          cources[year][group][lab].exam = { allow: 0, block: 0 }
        });
      }

      /*Create menu dropdown */
      var div = document.createElement('div');
      div.style = 'margin: 16px;';
      div.innerHTML = `
      <p>Year</p><select class="year"><option disabled selected hidden>Select...</option></select>
      <!--<p>Select Cource</p><select class="cource"><option>Select...</option></select>-->`;
      document.body.appendChild(div);
      var dyear = div.querySelector('.year');
      cources.years.forEach((y) => {
        dyear.innerHTML += `<option value="${y}">${y}</option>`;
      });
      dyear.addEventListener('change', function () { getAllStudents(this.value, cources[this.value]) });
    }
    //return;

    //getAllStudents(cources);

    async function getAllStudents(/*cources*/year, yearOBJ) {
      var totalRequests = 0;
      //for (let i = 0, l = cources.years.length; i < l; i++) {
      //var year = cources.years[i];
      for (var ii = 0, ll = yearOBJ.groups.length; ii < ll; ii++) {
        var group = yearOBJ.groups[ii];
        for (var iii = 0, lll = yearOBJ[group].labs.length; iii < lll; iii++) {
          var lab = yearOBJ[group].labs[iii];
          totalRequests++;
          var url = 'http://acm.vgtu.lt' + yearOBJ[group][lab].url;
          requiredForUpdateURLs.push({
            year: year,
            group: group,
            lab: lab,
            url: url
          });
          var page = await Core.page.getPage(url);
          getListOfStudentsInOneLab(page, yearOBJ[group][lab], year + group + lab);

          /* Start updating records */
          if (totalRequests == ll * lll) {
            console.log('Lists ready.');
            await getExams(year);
            console.log('Exams ready.');
            console.log(cources);
            var table = document.getElementById('allStudAllLab_' + year);
            table ? table.closest('table').classList.remove('blur') : null;
            exportDataAndGrades();
            setTimeout(() => { updateStudents(); }, 10000);
          }
        };
      };
      //};
    }

    function getListOfStudentsInOneLab(page, studentList, yearGroupLab) {
      var studens = [...page.querySelectorAll('table>tbody>tr')];
      var totalTasks = page.querySelectorAll('table>thead>tr>.ir-scorecell').length;
      studens.forEach(student => getStudent(student, studentList, yearGroupLab, totalTasks))
    };

    async function getStudent(student, studentList, yearGroupLab, totalTasks) {
      var name = student.querySelector('.ir-student-name>a');
      var profileURL = name.getAttribute('data-poload').replace('card/', '');
      var solutionsInThisLab = name.getAttribute('href');
      var surname = name.innerHTML.slice(name.innerHTML.indexOf('</span>') + 8);
      var uid = await Core.page.getPage(profileURL);
      uid = uid.querySelector('h1>small').innerText;
      name = name.querySelector('.ir-lname').innerText;
      studentList.students[profileURL] = {
        uid: uid,
        name: name,
        surname: surname,
        profile: profileURL,
        solutions: solutionsInThisLab,
        domID: yearGroupLab + profileURL,
        labs: {
          done: student.querySelectorAll('.ir-scorebox-accepted').length,
          atempt: student.querySelectorAll('.ir-scorebox-attempted').length,
          total: totalTasks
        }
      }
      Object.defineProperty(studentList.students[profileURL], "parent", { enumerable: false, value: studentList.students });
      createRowInTable(studentList, profileURL);
    }

    function updateStudents() {
      var total = 0;
      requiredForUpdateURLs.forEach(async function (rec) {
        total++;
        var page = await Core.page.getPage(rec.url);
        updateStudentsLabs(page, rec);
        total--;
        if (total === 0) {
          ping();
          setTimeout(() => { updateStudents(); }, 5000);
        }
      })
    }

    function ping() {
      document.querySelector('.ani_update').classList.add('ping');
      setTimeout(() => { document.querySelector('.ani_update').classList.remove('ping'); }, 2000);
    }

    function updateStudentsLabs(page, rec) {
      var studens = [...page.querySelectorAll('table>tbody>tr')];
      studens.forEach(function (student) {
        var id = student.querySelector('a').getAttribute('data-poload').replace('card/', '');
        var studentID = rec.year + rec.group + rec.lab + id;
        var done = student.querySelectorAll('.ir-scorebox-accepted').length;
        var atempt = student.querySelectorAll('.ir-scorebox-attempted').length;
        var current = cources[rec.year][rec.group][rec.lab].students[id];
        if (!current || !current.labs) {
          console.error('Error on cources[rec.year][rec.group][rec.lab].students[id]');
        }
        if (current.labs.done != done) {
          setNewValue(studentID, 'done', done, true, current)
        }
        if (current.labs.atempt != atempt) {
          setNewValue(studentID, 'atempt', atempt, false, current)
        }
      })
    }

    function setNewValue(studentID, type, value, flash, student) {
      student.labs[type] = value;
      var dom = document.getElementById(studentID);
      if (dom) {
        type = dom.querySelector(`.${type}`);
        if (!type) { return }
        type.innerHTML = value;
        if (flash) {
          dom.parentNode.classList.add('highlight');
          setTimeout(function () { this.classList.remove('highlight') }.bind(dom.parentNode), 3000);
        }
        //console.log('Student', studentID, type, value);
      }
    }


    function createTable(id, header) {
      var container = document.createElement('div');
      container.className = 'table_all';
      container.innerHTML = `
      <div><h4>${header}<a title="Export data to Mano system"><svg id = "exportData" width="16" height="16" style="margin-left: 5px;cursor: pointer; display:none;" x="0" y="0" viewBox="0 0 366.999 366.999"><path d="M363.598 247.01c.146-.177.272-.365.409-.547.157-.209.319-.414.464-.632.145-.216.27-.441.402-.662.118-.198.243-.392.352-.596.121-.225.223-.458.332-.688.101-.213.207-.423.298-.643.092-.223.167-.451.248-.678.085-.235.175-.467.248-.708.068-.226.118-.454.176-.683.062-.246.131-.49.181-.741.052-.261.082-.524.12-.788.032-.221.074-.439.096-.664.048-.485.073-.973.074-1.46l.001-.02-.001-.025c0-.486-.025-.971-.073-1.455-.022-.225-.064-.442-.096-.664-.038-.263-.068-.526-.12-.787-.05-.253-.12-.499-.182-.747-.057-.226-.107-.453-.174-.677-.073-.242-.164-.476-.25-.713-.081-.225-.155-.452-.246-.673-.092-.221-.199-.432-.3-.647-.108-.229-.209-.459-.329-.683-.11-.206-.236-.401-.355-.6-.131-.221-.256-.443-.4-.658-.147-.219-.31-.424-.467-.635-.136-.182-.262-.368-.407-.544a14.95 14.95 0 0 0-.948-1.049c-.016-.016-.029-.034-.045-.05l-37.499-37.501c-5.857-5.857-15.355-5.858-21.213-.001-5.858 5.858-5.858 15.355 0 21.213l11.894 11.895-45.788.002v-78.605c.003-.133.02-.263.02-.396a14.92 14.92 0 0 0-3.407-9.49l-.064-.079a15.166 15.166 0 0 0-1.002-1.091c-.132-.131-.255-.272-.393-.398L155.609 22.896a14.985 14.985 0 0 0-.97-.882c-.104-.087-.212-.169-.318-.253a14.853 14.853 0 0 0-1.914-1.293c-.112-.063-.22-.132-.334-.193a14.657 14.657 0 0 0-1.109-.534c-.154-.067-.311-.124-.467-.186a14.539 14.539 0 0 0-2.158-.668c-.131-.029-.259-.066-.392-.093-.42-.084-.844-.146-1.27-.193-.13-.015-.262-.023-.393-.035a15.014 15.014 0 0 0-1.06-.054c-.076-.002-.148-.012-.224-.012H15c-8.284 0-15 6.716-15 15v300c0 8.284 6.716 15 15 15h240c8.284 0 15-6.716 15-15v-80.999l45.786.001-11.893 11.893c-5.858 5.858-5.858 15.355 0 21.213 2.929 2.929 6.768 4.394 10.606 4.394s7.678-1.464 10.606-4.394l37.499-37.499.021-.023c.343-.344.667-.703.973-1.076zM160 69.713l58.787 58.787H160V69.713zM240 318.5H30v-270h100v95c0 8.284 6.716 15 15 15h95v64.001l-65.001-.001c-8.284 0-15 6.716-15 15 0 8.284 6.716 15 15 15l65.001.001V318.5z" fill="#000000" opacity="1" data-original="#000000" class=""></path></svg></a></h4></div>
      <table class="ir-table-more-condensed table-striped ir-course-standings blur">
      <colgroup span="2"></colgroup>
      <colgroup span="30"></colgroup>
      <colgroup span="2"></colgroup>
      <thead>
          <tr>
              <th class="ir-sticky-column" rowspan="1">
              <div class="ani_update">
                <span class="animate-ping"></span>
                <span class="animate-ping-back"></span>
              </div><span style="float:right;"></span></th>
              <th class="ir-sticky-column" rowspan="1"><input style="border: none;background: none;" class="search" title="Find Student" placeholder="Student"></input> <a sort="0" sort-way="1">˅</a></th>
              <th class="ir-sticky-column">Group<a sort="0" sort-way="1">˅</a></th>
              <th class="ir-sticky-column" rowspan="1">Grade <a sort="0" sort-way="1">˅</a></th>
          </tr>
          <!--<tr>
            <th style="order: -1;"></th>
            <th style="order: 0;"></th>
          </tr>-->
      </thead>
      <tbody id="${id}"></tbody>
      </table>
      `;
      container.querySelector('.search').addEventListener('input', filterRows);
      var th = [...container.querySelectorAll('a[sort]')];
      th.forEach(t => t.addEventListener('click', sortTable.bind(t.parentNode)));
      Core.style.addStyle('tableStyle', `
      :root{
        --pingColor: #00d52e;
      }
      table {
        border-collapse: collapse;
        border-spacing: 0;
        table-layout: fixed;
      }
      .blur{
          filter: blur(2px);
      }
      .prof_container{
        display: flex;
      }
      .table_all th{
        text-align: left;
      }
      .table_all th>input{border: none;background: none;width: calc(100% - 20px);}
      .table_all th>input::placeholder {
        color: rgb(51, 51, 51);
      }
      .table_all th>input:hover::placeholder{
        color: #9f9b9b;
      }
      .table_all th>input::-ms-input-placeholder {
        color: rgb(51, 51, 51);
      }
      .table_all th>input:hover::-ms-input-placeholder {
        color: #9f9b9b;
      }
      table>thead{
        position: sticky;
        top: 0;
        z-index: 2;
        box-shadow: inset #e5e5e5 0px 0px 0px 20px, #e5e5e5 0px 2px 8px 0px;
      }
      .table_all thead>tr+tr>th{
        text-align: center;
        font-size: 10px;
        line-height: 8px;
        background-color: #f9f9f9 !important;
      }
      .table_all th>a{
        cursor: pointer;
        float: right;
        margin-left: 6px;
      }
      .table_all{
        position: relative;padding-left: 14px;width: 100%;
      }
      .ani_update{
        position: fixed;
        top: 8px;
        left: 8px;
        width: 8px;
        z-index: 2;
        height: 8px;
        position: absolute;
        line-height: 0;
      }
      .animate-ping {
        position: absolute;
        display: inline-flex;
        height: 100%;
        width: 100%;
        border-radius: 100%;
        opacity: 0.75;
        background-color: var(--pingColor);
      }
      .ping>.animate-ping{
        animation: ping 1s cubic-bezier(0,0,.2,1) 1;
      }
      .animate-ping-back{
        position: relative;
        display: inline-flex;
        border-radius: 100%;
        width: inherit;
        height: inherit;
        background-color: var(--pingColor);
      }
      @keyframes ping {
        0% {
          transform: scale(1);
          opacity: 1
        }
        75%,to {
            transform: scale(2.5);
            opacity: 0
        }
      }
      .ir-student-name{
        display: flex;
        justify-content: space-between;
      }
      .ir-student-name>a:nth-child(2){
        opacity: 0;
        text-decoration: none;
      }
      .ir-student-name:hover>a:nth-child(2){
        opacity: 1;
      }
      .ir-course-standings > thead > tr:nth-of-type(odd) > th {
        border-bottom: 2px solid #ddd;
      }
      .ir-course-standings > tbody > tr:first-child > td {
        border-top: none;
      }
      .ir-course-standings > tbody > tr > td+td+td {
        text-align: end;
      }
      .ir-course-standings .ir-seq-no {
        box-shadow: inset 0px 0 0 #ddd;
      }
      .ir-table-more-condensed{
        border-left: 2px solid #ddd;
      }
      .ir-table-more-condensed tr>td>span{
        display: inline-flex;
        max-width: 0px;
        overflow: hidden;
        transition: 0.3s;
        color: orange;
        font-size: 10px;
      }
      .ir-table-more-condensed tr:hover>td>span{
        max-width: 100px;
      }
      #all_students tr{
        position: relative;
      }
      .highlight>td{
        background: none !important;
      }
      .highlight{
        background: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(2,0,36,0) 10%, rgba(231,124,2,1) 10%, rgba(231,124,2,1) 90%, rgba(0,0,0,0) 90%, rgba(0,0,0,0) 100% );
        background-size: 1000% 1000%;
        animation: ani_highlight 5s linear 1;
        transition: transform .3s ease;
      }
      @keyframes ani_highlight {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      .issue{color: red;}
      `);
      document.body.appendChild(container);
      container.querySelector('tbody').headLabs = container.querySelector('table>thead>tr');
      var table = container.querySelector('tbody');
      table.sortCol = 1;
      table.sortType = 1;
      return table;
    }

    var i = 0;
    function createRowInTable(studentList, profile) {
      var id = 'allStudAllLab_' + studentList.year;
      var table = document.getElementById(id);
      if (!table) {
        table = createTable(id, 'All Students - Labs');
      }
      id = 'allStudAllLab_' + studentList.lab.replaceAll(' ', '');
      var lab = table.headLabs.querySelector('#' + id);
      var order = studentList.lab.slice(0, studentList.lab.indexOf(' '));
      if (!lab) {
        var th = document.createElement('th');
        th.id = id;
        th.setAttribute('colspan', 1);
        th.style.order = order;
        th.innerHTML = studentList.lab + ' Lab <a sort="0" sort-way="1">˅</a>';
        table.headLabs.insertBefore(th, table.headLabs.children[table.headLabs.children.length - 1]);
        //.insertBefore(td, row.children[row.children.length-1]);
        lab = th;
        var th = th.querySelector('a[sort]');
        th.addEventListener('click', sortTable.bind(th.parentNode));
      }
      var student = studentList.students[profile];
      var row = document.getElementById(student.profile);

      if (!row) {
        var tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${++i}</td>
      <td class="name"><a href="${profile}" target="_blank"><strong>${student.surname}</strong> ${student.name}</a></td>
      <td><a href="${studentList.url}" target="_blank">${studentList.group}</a></td>
      <td class="grade">0</td>`;
        tr.id = student.profile;
        table.appendChild(tr);
        row = tr;
      }
      var td = document.createElement('td');
      td.id = student.domID;
      td.style.order = order;
      var hint = Math.round((student.labs.done / student.labs.total) * 100) / 10;
      var title = `Grade: ${hint}\nMano Grade: ${hint}`;
      td.innerHTML = `
        <!--<span class="atempt">${student.labs.atempt}</span>-->
        <a href="${student.solutions}" target="_blank" class="done" data-id="lab${studentList.lab}" title="${title}">${student.labs.done}</a>`;
      row.insertBefore(td, row.children[row.children.length - 1]);
      var gradeDom = row.querySelector('.grade');
      var labs = gradeDom.labs || []; labs.push(student);
      gradeDom.labs = labs;
      var n = labs.length;
      var res = 0;
      var allLabsHasAtleast1 = true;
      if (labs.length < student.parent.parent.parent.labs.length) { return }
      labs.forEach(function (r) {
        res += (r.labs.done / r.labs.total) / n;
        if (r.labs.done === 0) {
          allLabsHasAtleast1 = false;
        }
      });
      if (allLabsHasAtleast1) {
        labs.forEach(function (r) {
          if (!r.labsShift && r.labs.done / r.labs.total < 0.5 ||
            r.labsShift && r.labsShift.done / r.labsShift.total < 0.5) {
            if (!r.shift) {
              r.labsShift = { done: r.labs.done, total: r.labs.total };
            }
            var ar = student.parent.parent.parent;
            for (let i = -1, l = ar.labs.length - 1; l > i; l--) {
              if (r.labsShift.done / r.labsShift.total >= 0.5) { return };
              var lab = ar[ar.labs[l]].students[student.profile];
              if (!lab) { continue; }
              if (!lab.labsShift) {
                lab.labsShift = { done: lab.labs.done, total: lab.labs.total };
              }
              if (lab.labsShift.done / lab.labsShift.total <= 0.5) { continue }
              shift(r, lab, 0);
            }
            function shift(to, from, inc) {
              if (from.labsShift.done <= 15) {
                console.error('ERROR: from.labsShift.done<=15');
              }
              to.labsShift.done++;
              from.labsShift.done--;
              inc++;
              if (to.labsShift.done / to.labsShift.total < 0.5 && from.labsShift.done / from.labsShift.total > 0.5) {
                shift(to, from, inc);
              }
              else {
                function title(rec, inc) {
                  var dom = document.getElementById(rec.domID).querySelector(`.done`);
                  var span = dom.nextSibling;
                  if (!span) {
                    span = document.createElement('span');
                    dom.parentElement.appendChild(span);
                  }
                  span.innerHTML += `(${inc})${rec.labsShift.done}`;
                  var t = dom.title.split(':');
                  t[t.length - 1] = Math.floor(rec.labsShift.done / rec.labsShift.total * 100) / 10;
                  dom.title = t.join(':');
                  dom.style.color = 'orange';
                  //rec.shift={done:rec.done,total:rec.total};
                }
                title(to, '+' + inc);
                title(from, '-' + inc);
              }
            }
          }
        });
      }
      res = Math.round(res * 100) / 10;
      gradeDom.innerText = res;
      if (res < minGrade || !allLabsHasAtleast1) {
        gradeDom.classList.add('issue');
        storage[studentList.year][studentList.group][studentList.lab].exam.allow--;
        storage[studentList.year][studentList.group][studentList.lab].exam.block++;
        storage[studentList.year][studentList.group].exam.allowed[student.profile] = 0;
        delete (storage[studentList.year][studentList.group].exam.alloweduid[student.uid]);
      }
      else {
        gradeDom.classList.remove('issue');
        storage[studentList.year][studentList.group][studentList.lab].exam.block--;
        storage[studentList.year][studentList.group][studentList.lab].exam.allow++;
        storage[studentList.year][studentList.group].exam.allowed[student.profile] = res;
        storage[studentList.year][studentList.group].exam.alloweduid[student.uid] = student.profile;
      }
    }

    function exportDataAndGrades() {
      /* Export */
      var dom = document.getElementById('exportData');
      dom.style.display = '';
      dom.addEventListener('click', exportD);
      function exportD() {
        if (Object.keys(canExport).length === 0) {
          Core.popup('No Tabs for export was found.\nOpen Mano system in another tab of your browser or refresh required tab.');
          return;
        }
        Core.browser.sendData('setValuesForLab', JSON.stringify(storage));
        localStorage.setItem('allStudentsLabGrades', JSON.stringify(storage));
        Core.popup('Students grades was exported');
        console.log('Browser data is sent', storage);
      }
    }

    function filterRows() {
      var rows = [...this.closest('table').querySelectorAll('tbody>tr')];
      rows.forEach((row) => {
        if (row.querySelector('.name').innerText.toLowerCase().indexOf(this.value.toLowerCase()) > -1) {
          row.style.display = 'table-row';
        }
        else {
          row.style.display = 'none';
        }
      });
    }

    /* Sort */
    const getCellValue = (tr, idx) => tr.children[idx] ? (tr.children[idx].innerText || tr.children[idx].textContent) : "";
    const comparer = (idx, asc) => (a, b) => ((v1, v2) =>
      v1 !== '' && v2 !== '' && !isNaN(v1) && !isNaN(v2) ? v1 - v2 : v1.toString().localeCompare(v2)
    )(getCellValue(asc ? b : a, idx), getCellValue(asc ? a : b, idx));

    function sortTable(event, table) {
      var index = null;
      var way = null;
      if (table) {
        index = table.sortIndex || 1;
        way = table.sortWay || 0;
      }
      else {
        table = this.closest('table').querySelector('tbody');
        index = Array.from(this.parentNode.children).indexOf(this);
        table.sortIndex = index;
        table.sortWay = !table.sortWay;
        way = table.sortWay;
      }
      Array.from(table.querySelectorAll('tr:nth-child(n+1)'))
        .sort(comparer(index, way))
        .forEach(tr => table.appendChild(tr));

      var rows = table.rows;
      for (let i = 0, l = rows.length; i < l; i++) {
        rows[i].getElementsByTagName("TD")[0].innerHTML = i + 1;
      }
    }


    async function getExams(yearReq) {
      var page = await Core.page.getPage('http://acm.vgtu.lt/contests/my/');
      var years = page.querySelectorAll('table tr');
      var collect = false;
      var yearC = '';
      var year = '';
      var requiredURLs = 0;
      years.forEach(async (y) => {
        if (y.querySelector('th')) {
          year = y.querySelector('th').innerText.replace(/\n| /g, '');
          yearC = `${Number(year) - 1}–${year}`;
          if (yearC === yearReq) {
            collect = true;
          }
        }
        else if (collect) {
          if (y.children[1].innerText.indexOf(year) > -1) {
            requiredURLs++;
            await parseGrades(y.querySelector('a').getAttribute('href'), yearC);
            requiredURLs--;
          }
        }
        if (requiredURLs === 0) {
          return true;
        }
      });
    }

    async function parseGrades(url, year) {
      var page = await Core.page.getPage(url);
      //var yearC = page.querySelector('*:last-child').innerText.match(/(\d{4}-\d{4}|\d{4})/g)[0];
      //if(yearC!==year){console.log('ERROR'); debugger;}
      var group = page.querySelector('.container .list-group-item-success').children[1].innerText.split(' ').pop();
      /*Object.defineProperty(cources[year][group], "exam", {
        enumerable: false,
        value: {},
      });*/
      var exam = cources[year][group];
      var students = page.querySelectorAll('.ir-contest-standings>tbody>tr');
      var total = page.querySelectorAll('table>thead th:not([class])').length;
      students.forEach(async (student) => {
        var studentID = `/${student.querySelector('a').getAttribute('href').split('?').pop().replace('=', 's/')}/`
        var done = Number(student.querySelector('.ir-problem-count').innerText);
        var result = done === 0 ? 0 : (done - 1) + 5;
        if(result===0){
          var participated = await Core.page.getPage(student.querySelector('td:nth-child(2)>a').getAttribute('href'));
          if(!participated.documentElement.querySelector('table')){result='P'}
        }
        exam.exam[studentID] = { done: done, total: total, grade: result, allowed: exam.exam.allowed[studentID] ? true : false };
      });
    }

    const canExport = {};
    Core.browser.addEventListener('webPageOpened', webPageOpened);
    function webPageOpened(url) {
      Core.popup(`Connected with ${url}`);
      canExport[url] = true;
    }

    Core.help([
      `<a style="color: orange">Orange grades</a> - are shifted grades, which are calculated as follows:
          If the grade of any laboratory work is below 5, then the tasks from the previous laboratory are transferred to the current one and subtracted from the previous laboratory.
          The shifted grades are used just in Mano system to set 5 for labs.`,
      `<a style="color: red">Red grades</a> - displays students who are not allowed to participate in the exam.`,
      `The <a style="color: blue">Export button</a> allows to export the grades of the students into Mano system.
          In order to export grades follow the steps:
          1. Open Mano system in another TAB of the browser (exams and/or labs)
          2. Click Export button
          3. See the message in Mano system about imported grades
          4. Continue work in Mano system`
    ]);
  }
  /* === */

  /* Page with Exam */
  function examPage() {
    Core.style.addStyle('ExamMarks_styles', `
     .issue>*{
       background: #ff00003d !important;
     }`);
    var cources = localStorage.getItem('allStudentsLabGrades');
    if (!cources) { return; }
    var date = localStorage.getItem('allStudentsLabGrades_updateTime');
    if (date) {
      date = new Date(date);
      var cur = new Date();
      var diffDays = Math.ceil(Math.abs(cur - date) / (1000 * 60 * 60 * 24)) - 1;
      if (diffDays > 0) {
        Core.popup(`Students grades was updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`);
      }
    }
    cources = JSON.parse(cources);
    var year = document.querySelector('.list-group-item-success>*:last-child').innerText.match(/(\d{4}-\d{4}|\d{4})/g)[0];
    year = `${Number(year) - 1}–${year}`;
    var group = document.querySelector('.container .list-group-item-success').children[1].innerText.split(' ').pop();
    var grade = cources[year][group].exam.allowed;
    var students = document.querySelectorAll('.ir-contest-standings>tbody>tr');
    students.forEach((student) => {
      var studentID = `/${student.querySelector('a').getAttribute('href').split('?').pop().replace('=', 's/')}/`
      var a = document.createElement('a');
      a.style = 'float: right;';
      a.innerHTML = grade[studentID];

      if (grade[studentID] < 5) {
        student.classList.add('issue');
      }

      student.children[1].appendChild(a);
    });
  }

  /* Exam Comparer */
  function initExamComparer_helper() {
    Core.style.addStyle('ExamComparer_helper', `
    nav.navbar,.container>.panel-default,.container>.form-group,.footer{
      display:none !important;
    }
    .container>.row>div{
      display: none;
    }
    .container{
      margin: 0;
      margin-top: 24px;
      margin-bottom: 24px;
      width: 100%;
      height: 100%;
    }
    .block{
      border: 2px solid orange;
      border-radius: 6px;
    }
    colgroup.block{
      border-top: 2px solid orange;
      border-bottom: 2px solid orange;
      border-left: 3px solid orange;
      border-right: none;
    }
    colgroup.block+colgroup{
      border-top: 2px solid orange;
      border-bottom: 2px solid orange;
      border-left: none;
      border-right: none;
    }
    colgroup.block+colgroup+colgroup{
      border-top: 2px solid orange;
      border-bottom: 2px solid orange;
      border-left: none;
      border-right: 2px solid orange;
    }
    `);
    var col = [...document.querySelectorAll('.linenodiv>pre>a')];
    for (let i = 0, l = col.length; i < l; i++) {
      col[i].addEventListener('click', function () {
        var r = document.querySelector(`a[name="${this.getAttribute('href').replace('#', '')}"]`);
        this.style.display = 'none';
        r.style.display = 'none';
        doe(r.nextElementSibling);
        function doe(el) {
          if (el.getAttribute('name')) { return }
          el.style.display = 'none';
          if (el.nextElementSibling) { doe(el.nextElementSibling) }
        }
      })
    }
  }
  function examComparer() {
    /* Comparer for an Exam */
    var button = document.createElement('a');
    button.className = 'list-group-item';
    button.style.cursor = 'pointer';
    button.addEventListener('click', initCompare);
    button.innerHTML = `<span class="ir-icon-label">📄Open comparer</span>`;
    document.querySelector('.list-group').appendChild(button);

    function initCompare(event, type) {
      if (!type) {
        var prev = '';
        if(document.querySelector('select[name="problem"]').selectedIndex==0){prev+='\nSelect the task to compare'};
        if(document.querySelector('select[name="state"]').selectedIndex==0){prev+='\nSelect the status of the task'};
        if(prev!==''){
          var pop = Core.popup(`Before comparing:${prev}<button>OK</button></div>`, 'comparer_type', '', 10000000);
          pop.eventMessage = function (button) {Core.popup(false, 'comparer_type');}
          return;
        }
        var pop = Core.popup('Select comparer type:<button>iRunner</button><button>Another</button><button>Cancel</button></div>', 'comparer_type', '', 10000000);
        pop.eventMessage = function (button) {
          Core.popup(false, 'comparer_type');
          var responce = button.innerText;
          if(responce === 'Cancel'){return}
          initCompare(null, responce);
        }
        return;
      }
      const comparerType = type;
      Core.style.addStyle('examComparer_main', `
      body{
        overflow: hidden;
      }
      iframe{
        border: 1px solid white;
      }
      nav.navbar{
        display: none;
      }
      .examComparison_container{
        position: fixed;top:0;left:0;bottom:0;right:0;z-index:99;display: flex;
        flex-wrap: wrap;
        background: #e7e7e7;
      }
      .examComparison_container>div[data-window]{
        flex:1;
        height: calc(100% - 42px);
      }
      .examComparison_container>div[data-window]>iframe{
        width: 100%;
        height: 100%;
      }
      .examComparison_container>._footer{
        flex: 1;
        background: #dbdbdb;
        width: 100%;
        padding: 6px;
        flex-basis: 100%;
        height: 42px;
        display: flex;
      }
      .examComparison_container>._footer>div[data-stud]{
        flex:0.5;
        height: 100%;
        display: flex;
      }
      ._footer .controls{
        display: flex;
        flex-direction: row;
        flex:0;
        font-size: 24px;
      }
      ._footer .info{
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
      ._footer>*[data-stud="1"]>.info>span{
        position: absolute;
        right: 0;
        margin: 16px;
      }
      ._footer>*[data-stud="2"]>.info>span{
        position: absolute;
        left: 0;
        margin: 16px;
      }
      ._footer .inact{
        opacity: 0.6;
      }
      ._footer .prev,._footer .next,._footer .close,._footer .down,._footer .up {
        cursor: pointer;
      }
      ._footer>*[data-stud="1"] .down{
        margin-left:24px;
      }
      ._footer>*[data-stud="2"] .down{
        margin-right:24px;
      }
      ._footer .close{
        width: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0.8;
      }
      ._footer .close:hover,._footer .down:hover{
        opacity: 1;
      }
      ._footer>.controls{
        box-shadow: inset 0px -1px 0px 1px gray;
        height: 46px;
        flex-basis: 10px;
        margin-left: 7px;
        margin-right: 7px;
        margin-top: -6px;
        /*justify-content: center;*/
        display: flex;
        flex-direction: column;
      }
      ._footer>.controls input{
        display: none;
      }
      ._footer>.controls label{
        font-size: 12px;
        margin: 0;
        padding: 0;
        overflow: hidden;
        width: 0;
        height: 0px;
        transition: 0.3s;
        text-wrap: nowrap;
        cursor: pointer;
      }
      ._footer>.controls:hover>#smart_controls+label,
      ._footer>.controls>#smart_controls:checked+label{
        width: 20px;
        height: 20px;
        background: #e7e7e7;
        border: 1px solid gray;
        border-radius: 6px;
        margin: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      ._footer>.controls>#smart_controls+label:before{
        scale: 0;
        overflow: hidden;
        content:"✔";
        font-size: 16px;
        transition: 0.3s;
      }
      ._footer>.controls:hover>#smart_controls+label:before{
        color: gray;
        scale: 1;
      }
      ._footer>.controls:hover>#smart_controls:checked+label:before{
        scale: 0;
      }
      ._footer>.controls>#smart_controls:checked+label{
        width: 142px;
        margin-top: -20px;
        border-radius: 6px 6px 0 0;
        border-bottom: none;
        margin-left: 0;
        margin-right: 0;
      }
      ._footer>.controls>#smart_controls:checked+label:before{
        content:"✘";
      }
      ._footer>.controls>#smart_controls:checked+label:hover:before{
        scale: 1 !important;
      }
      ._footer>.controls>#smart_controls+label>span{
        overflow: hidden;
        max-width: 0px;
        transition: 0.3s;
        display: block;
      }
      ._footer>.controls>#smart_controls:checked+label>span{
        max-width: 142px;
        margin-left: -12px;
      }
      ._footer>.controls>#smart_controls:checked+label:hover>span{
        margin-left: 0px;
      }

      ._footer>.controls>#smart_controls+label+div{
        overflow: hidden;
        max-height: 0px;
        display: flex;
        flex-direction: column;
      }
      ._footer>.controls>#smart_controls:checked+label+div{
        max-height: 100px;
      }
      ._footer>.controls>#smart_controls:checked+label+div>label{
        display: unset;
        width: 140px;
        height: 20px;
      }
      ._footer>.controls>div>input+label:before{
        content: "";
        background: #ebebeb;
        width: 14px;
        height: 14px;
        display: inline-block;
        border: 1px solid black;
        border-radius: 4px;
        margin-left: 5px;
        font-size: 10px;
        padding-left: 2px;
        margin-right: 3px;
      }
      ._footer>.controls>div>input:checked+label:before{
        content: "✔";
      }
      `);

      var container = document.createElement('div');
      container.className = 'examComparison_container';
      document.body.appendChild(container);
      var url = window.location.origin;
      container.innerHTML = `
        <div data-window="1">
          <iframe src="${url}" title="Original"></iframe>
        </div>
        ${comparerType === 'Another' ? `
        <div data-window="2">
          <iframe src="${url}" title="Comparison"></iframe>
        </div>`: ''}
        <div class="_footer">
          <div data-stud="1">
            <a></a>
            <div class="info"></div>
            <div class="controls">
              <div class="prev inact">◀️</div>
              <div class="next">▶️</div>
              <div class="down" title="Disqualify">🔻</div>
              <div class="up" title="Remove Disqualification">🟢</div>
            </div>
          </div>
          <div class="controls">
            <input type="checkbox" id="smart_controls"></input>
            <label for="smart_controls"><span>Settings</span></label>
            <div>
              <input type="checkbox" checked = "true"  id="smart_controls_skipWarned"></input>
              <label title="Skip disqualifyed tasks in the right window" for="smart_controls_skipWarned">Skip disqualifyed</label>
              <input type="checkbox" checked = "true"  id="smart_controls_rightPlusOne"></input>
              <label title="In case the comparison is done in the following manner (left - right):\n1 - 1\n1 - 2\n1 - 3\n...\n1 - n\nThen combination of '2 - 1' was already done and as such,\nincrementation of student in left window should set right = left+1" for="smart_controls_rightPlusOne">Increment right side</label>
            </div>
          </div>
          <div data-stud="2">
            <div class="controls">
            <div class="up" title="">🟢</div>
              <div class="down" title="">🔻</div>
              <div class="prev inact">◀️</div>
              <div class="next">▶️</div>
            </div>
            <div class="info"></div>
            <a class="close">❌</a>
          </div>
        </div>`;

      const win1 = container.querySelector('*[data-window="1"]>iframe');
      const win1Stud = container.querySelector('._footer>*[data-stud="1"]>.info');
      const win1Prev = container.querySelector('._footer>*[data-stud="1"] .prev'); win1Prev.addEventListener('click', move.bind(win1Prev, 1, -1));
      const win1Next = container.querySelector('._footer>*[data-stud="1"] .next'); win1Next.addEventListener('click', move.bind(win1Next, 1, 1));

      const win1Down = container.querySelector('._footer>*[data-stud="1"] .down'); win1Down.addEventListener('click', down.bind(1, 0));
      const win2Down = container.querySelector('._footer>*[data-stud="2"] .down'); win2Down.addEventListener('click', down.bind(2, 0));
      const win1Up = container.querySelector('._footer>*[data-stud="1"] .up'); win1Up.addEventListener('click', down.bind(1, 1));
      const win2Up = container.querySelector('._footer>*[data-stud="2"] .up'); win2Up.addEventListener('click', down.bind(2, 1));
      const winClose = container.querySelector('._footer .close'); winClose.addEventListener('click', close);

      const win2 = container.querySelector('*[data-window="2"]>iframe');
      const win2Stud = container.querySelector('._footer>*[data-stud="2"]>.info');
      const win2Prev = container.querySelector('._footer>*[data-stud="2"] .prev'); win2Prev.addEventListener('click', move.bind(win2Prev, 2, -1));
      const win2Next = container.querySelector('._footer>*[data-stud="2"] .next'); win2Next.addEventListener('click', move.bind(win2Next, 2, 1));

      const skipWanred = container.querySelector('._footer>.controls #smart_controls_skipWarned');
      const rightPlusOne = container.querySelector('._footer>.controls #smart_controls_rightPlusOne');

      function allowPrevNext(el,allowed){
        allowed?el.classList.remove('inact'):el.classList.add('inact');
      }

      function move(w, m, isMove=true) {
        if(this&&this.classList.contains('inact')){return}
        if (w == 1) {
          if (m > 0) {
            /* Left window increase students number */
            if(w1+m===w2){
              if(!rightPlusOne.checked){
                w2<students.length - 1?move(w,m+1, isMove):allowPrevNext(win1Next,false);
                return;
              }
            }
            if(w1+m<students.length - 1&&students[w1].children[2].innerText == students[w1 + m].children[2].innerText){
              move(w,m+1, isMove); return;
            }
            if (w1+m < students.length) {
              if(isMove){w1+=m;setWindow(1, students[w1]); allowPrevNext(win1Prev,true); move(1,1,false)};
            }
            else{
              allowPrevNext(win1Next,false);
            }
          }
          else {
            /* Left window decrease students number */
            if(w1+m===w2){
              w2>0?move(w,m-1, isMove):allowPrevNext(win1Prev,false);
              return;
            }
            if(w1+m>-1&&students[w1].children[2].innerText == students[w1 + m].children[2].innerText){
              move(w,m-1, isMove); return;
            }
            if (w1+m > -1) {
              if(isMove){w1+=m;setWindow(1, students[w1]); allowPrevNext(win1Next,true); move(1,-1,false);}
              else{allowPrevNext(win2Prev,true);}
            }
            else{
              allowPrevNext(win1Prev,false);
            }
          }
          if (rightPlusOne.checked && w1 + 1 < students.length) {
            if(isMove){w2 = w1;move(2,1); move(2,-1,false);move(2,1,false);};
          }
        }
        else {
          if (m > 0) {
            /* Right window increase students number */
            if(w2+m===w1||w2+m < students.length&&(skipWanred.checked&&students[w2+m].classList.contains('warning')||students[w1].children[2].innerText == students[w2 + m].children[2].innerText)){
              w2+m<students.length - 1?move(w,m+1,isMove):allowPrevNext(win2Next,false);
              return;
            }
            if(w2+m<students.length - 1&&students[w2].children[2].innerText == students[w2 + m].children[2].innerText){
              move(w,m+1, isMove); return;
            }
            if (w2+m < students.length) {
              if(isMove){w2+=m;setWindow(2, students[w2]); allowPrevNext(win2Prev,true); move(2,1,false)}
              else{allowPrevNext(win2Next,true);}
            }
            else{
              allowPrevNext(win2Next,false);
            }
          }
          else {
            /* Right window decrease students number */
            if(w2+m===w1||w2+m > -1&&(skipWanred.checked&&students[w2+m].classList.contains('warning')||students[w1].children[2].innerText == students[w2 + m].children[2].innerText)){
              w2+m>0?move(w,m-1,isMove):allowPrevNext(win2Prev,false);
              return;
            }
            if(w2+m> -1&&students[w2].children[2].innerText == students[w2 + m].children[2].innerText){
              move(w,m-1, isMove); return;
            }
            if (w2+m > -1) {
              if(isMove){w2+=m;setWindow(2, students[w2]); allowPrevNext(win2Next,true); move(2,-1,false)}
              else{allowPrevNext(win2Prev,true);}
            }
            else{
              allowPrevNext(win2Prev,false);
            }
          }
        }
      }

      function close() {
        document.body.removeChild(container);
        document.head.removeChild(document.getElementById('examComparer_main'));
      }

      /* Dis/Qualify solution of the student in the exam */
      async function down(good) {
        async function dis_qualify(ids, action) {
          var req = '';
          ids.forEach((id)=>{req+=`&id=${id}`})
          var secret = document.querySelector('form[method="post"]>input[type="hidden"]');
          return await fetch(window.location.href, {
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "upgrade-insecure-requests": "1",
            },
            "body": `${secret.getAttribute('name')}=${secret.value}${req}&${action}=`,
            "method": "POST"
          }).then((res) => { return !res.ok ? false : true })
        }
        function collectAllAcceptedSolution(s, good){
          var ids = [];
          var studentName = s.children[2].innerText;
          [...s.parentElement.children].forEach((row)=>{
            if(row.children[2].innerText===studentName){
              ids.push(row.querySelector('input').value);
              good?row.classList.remove('warning'):row.classList.add('warning');
            }
          });
          return ids;
        }
        var s = this === 1 ? students[w1] : students[w2];
        var ids = collectAllAcceptedSolution(s, good);
        if (good) {
          var res = await dis_qualify(ids, 'qualify');
          if (res) {
            s.checked = true;
            setWanrirgs.call(this,null,false);
            Core.popup(`Qualifyed${ids.length>1?` (${ids.length})`:''}`, '', '', 1500);
          }
        }
        else {
          var res = await dis_qualify(ids, 'disqualify');
          if (res) {
            s.checked = true;
            setWanrirgs.call(this,null,true);
            Core.popup(`Disqualifyed${ids.length>1?` (${ids.length})`:''}`, '', '', 1500);
          }
        }
      }


      var students = document.querySelectorAll('table>tbody>tr');
      var w1 = 0;
      var w2 = 0;
      const storage = { 1: { el: [], val: [] }, 2: { el: [], val: [] } }

      setWindow(1, students[w1]);
      move(2,1);


      function setWanrirgs(student,action){
        var win = comparerType === 'Another'?this:1;
        var frame = document.querySelector(`*[data-window="${win}"] iframe`).contentDocument.body;
        if(frame.children.length===0){
          setTimeout(setWanrirgs.bind(this),100);
          return;
        }
        if (student&&student.classList.contains('warning')||action) {
          comparerType === 'Another' ? frame.querySelector('.codehilite').classList.add('block') : frame.querySelector(`.diff colgroup:nth-child(${(this * 3) - 2})`).classList.add('block');
        }
        else {
          comparerType === 'Another' ? frame.querySelector('.codehilite').classList.remove('block') : frame.querySelector(`.diff colgroup:nth-child(${(this * 3) - 2})`).classList.remove('block');
        }
      }


      function setWindow(win, student) {
        var windo = null;
        var windoStud = null;
        var w = null;
        if (win == 1) {
          windo = win1;
          windoStud = win1Stud;
          w = w1;
          /*w2 = w1 !== 0 ? 0 : 1;
          setWindow(2, students[w2]);
          win2Next.classList.remove('inact');
          win2Prev.classList.add('inact');*/
        }
        else {
          windo = win2;
          windoStud = win2Stud;
          w = w2;
        }
        if (comparerType === 'Another') {
          windo.src = student.querySelector('a[class]').getAttribute('href');
          setTimeout(initCompareWindow.bind(student, win), 500);
        }
        else if (comparerType === 'iRunner') {
          var first = students[w1].querySelector('a[class]').href.match(/\/solutions\/(.*?)\/source/)[1];
          var second = students[w2].querySelector('a[class]').href.match(/\/solutions\/(.*?)\/source/)[1];
          win1.src = `http://acm.vgtu.lt/solutions/compare/?first=${first}&second=${second}`;
        }
        var time = student.children[3].innerText.match(/..:.. .../); time = time ? time[0] : '';
        windoStud.innerHTML = `${student.children[2].innerText} / ${time}<span>${w + 1}/${students.length}</span>`;
        setTimeout( setWanrirgs.bind(win, student), 500)
      }

      function initCompareWindow(win) {
        var test = document.querySelector(`*[data-window="${win}"] iframe`).contentDocument.body;
        if (!test || !test.querySelector('.highlighttable .highlight>pre')) {
          setTimeout(initCompareWindow.bind(this, win), 1);
          return;
        }
        storage[1].el.forEach((el) => { el.style.background = 'none' });
        storage[2].el.forEach((el) => { el.style.background = 'none' });
        storage[1] = { el: [], val: [] };
        storage[2] = { el: [], val: [] };
        function collectElements(code, win) {
          [...code.children].forEach((word) => {
            var text = word.innerText;
            if (text == 'return' || text == 'begin' || text == '())' || text == 'main' || text == "using" || text == "namespace") { return }
            if (text.length > 3) {
              storage[win].el.push(word);
              storage[win].val.push(text);
            }
          })
        }
        collectElements(document.querySelector(`*[data-window="${1}"] iframe`).contentDocument.body.querySelector('.highlighttable .highlight>pre'), 1);
        collectElements(document.querySelector(`*[data-window="${2}"] iframe`).contentDocument.body.querySelector('.highlighttable .highlight>pre'), 2);
        compare(win);
      }
      function compare(win) {
        if (win === 1 && storage[2].val.length === 0 || win === 2 && storage[1].val.length === 0) {
          return;
        }
        for (let i = 0, l = storage[1].val.length; i < l; i++) {
          var idx = storage[2].val.indexOf(storage[1].val[i]);
          if (idx > 0) {
            var color = '#ff9393';
            if (storage[1].val[i].length > 11) { color = 'red' }
            storage[1].el[i].style.background = color;
            storage[2].el[idx].style.background = color;
            storage[2].el.splice(idx, 1);
            storage[2].val.splice(idx, 1);
          }
        }
      }
    }
  }


  /* MANO GRADES */

  if (window.location.origin === 'https://rep.vgtu.lt') { manoStudentsGrades() }
  function manoStudentsGrades() {
    Core.browser.sendData('webPageOpened', window.origin.replace('https://', '').replace('http://', ''));
    Core.browser.addEventListener('setValuesForLab', shareData);
    if (document.querySelector('.t-Body-title>.t-BreadcrumbRegion>.t-BreadcrumbRegion-buttons>button>.t-Button-label')) {
      var container = document.querySelector('.t-Body-title>.t-BreadcrumbRegion>.t-BreadcrumbRegion-buttons');
      var dom = document.createElement('div');
      dom.className = 't-Button';
      dom.innerText = 'Set Grades';
      dom.addEventListener('click', setGrades);
      container.insertBefore(dom, container.children[0]);
      setGrades()
    }
  }
  function shareData(data, origin) {
    if (origin != "http://acm.vgtu.lt/proff") { return }
    localStorage.setItem('allStudentsLabGrades', data);
    localStorage.setItem('allStudentsLabGrades_updateTime', new Date());
    Core.popup('Students grades was imported');
  }
  function setGrades(setGrade) {
    var data = localStorage.getItem('allStudentsLabGrades');
    if (!data) { return; }
    var date = localStorage.getItem('allStudentsLabGrades_updateTime');
    if (date) {
      date = new Date(date);
      var cur = new Date();
      var diffDays = Math.ceil(Math.abs(cur - date) / (1000 * 60 * 60 * 24)) - 1;
      if (diffDays > 0) {
        Core.popup(`Students grades was updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`);
      }
    }
    data = JSON.parse(data);
    var students = document.querySelectorAll('.t-fht-tbody>table>tbody>tr:not(:first-of-type)');

    var year = document.querySelector('.t-BreadcrumbRegion-breadcrumb>#P27_MOKSLO_METAI').value.replace('-', '–');
    var group = document.querySelector('.t-BreadcrumbRegion-breadcrumb>#P27_GRUPE').value;
    var lab = document.querySelector('.t-BreadcrumbRegion-breadcrumb>#P27_INFO').value;
    lab = lab.slice(lab.indexOf('Nr.') + 3);
    data = data[year][group][lab].students;
    console.log(data);
    var keys = Object.keys(data);
    var workerTasks = [];
    var stats = { same: 0, diff: 0 };
    students.forEach((student) => {
      var uid = student.childNodes[1].innerText;
      var grade = student.childNodes[5].querySelector('input');
      for (let i = 0, l = keys.length; i < l; i++) {
        if (data[keys[i]].uid !== uid) { continue; };
        var labs = data[keys[i]].labsShift || data[keys[i]].labs;
        if (!setGrade && data[keys[i]].uid !== uid) {
          var a = createDOM();
          if (data[keys[i]].labsShift) { a.style.background = 'orange' }
          a.title = `Code is "${uid}", expected "${data[keys[i]].surname}" (${Math.round((labs.done / labs.total) * 100) / 10})`;
          if (data[keys[i]].name.indexOf(student.childNodes[3].innerText) > -1) {
            a.innerText = Math.round((labs.done / labs.total) * 100) / 10;
            a.style.color = 'red';
            workerTasks.push([grade, Math.round(a.innerText)]);
          }
          else { a.innerText = '?'; }
          return;
        }

        var result = Math.round((labs.done / labs.total) * 100) / 10;
        if (!setGrade) {
          var a = createDOM();
          a.innerText = result;
          if (data[keys[i]].labsShift) { a.style.color = 'orange'; a.title = `Done: ${data[keys[i]].labs.done}\nShift: ${labs.done}` }
          else { a.title = `Done: ${labs.done}` }
          if (Math.round(result) === Number(grade.value)) {
            stats.same++;
          }
          else if (result !== 0) { stats.diff++; grade.style.border = '1px solid red' }
        }
        else if (setGrade) {
          workerTasks.push([grade, Math.round(result)]);
        }
        return;
      }
      createDOM();
      function createDOM() {
        var a = document.createElement('a');
        a.style.width = '20px';
        grade.parentNode.insertBefore(a, grade);
        return a;
      }
    })
    if (setGrade) {
      worker();
    }
    else {
      if (stats.diff === 0) {
        Core.popup('All grades are accurate.');
      }
      else {
        Core.popup(`${stats.diff} grades need to be updated`, 'warn');
      }
    }


    function worker() {
      var grade = workerTasks[0][0];
      var value = workerTasks[0][1];
      if (value < 1 || Number(grade.value) == value) {
        workerTasks.shift();
        if (workerTasks.length > 0) {
          worker();
        }
        else { Core.popup('All grades was updated.') }
        return;
      }
      grade.value = value;
      grade.style.color = '#00bf00';
      grade.dispatchEvent(new Event('change', { bubbles: true }));
      workerTasks.shift();
      if (workerTasks.length > 0) {
        setTimeout(worker, 200);
      }
      else { Core.popup('All grades was updated.') }
    }
  }

  /* MANO Visited Groups */

  if (window.location.href.indexOf('mano.vilniustech.lt') > -1) { updateVisitedGroups() }
  function updateVisitedGroups() {
    /* Remove LogOut timer */
    APP_ENV_DEV = true;
    setInterval(() => { timeOutTime = 999 }, 120000)

    Core.browser.sendData('webPageOpened', window.origin.replace('https://', '').replace('http://', ''));
    Core.browser.addEventListener('setValuesForLab', shareData);
    function shareData(data, origin) {
      //if (origin != "http://acm.vgtu.lt/proff") { return }
      localStorage.setItem('allStudentsLabGrades', data);
      localStorage.setItem('allStudentsLabGrades_updateTime', new Date());
      Core.popup('Students grades was imported');
      updateForGrades(JSON.parse(data));
    }

    function update() {
      'use strict';
      var storage = localStorage.getItem('allStudentsLabGrades');
      if (storage) {
        storage = JSON.parse(storage);
        var container = document.querySelector('#mediate-inner>.with_arrow');
        if (container && !container.noCore_added) {
          iRunnerToMano_labs(container, storage);
        }
        container = document.querySelector('#gradesheet-main #gradesheet-table');
        if (container && !container.noCore_added) {
          iRunnerToMano_ExamsVisited(container, storage);
        }
        container = document.querySelector('.kv-grid-container>.gradesheet-table');
        if (container && !container.noCore_added) {
          iRunnerToMano_ExamsGrades(container, storage);
        }
      }
      setTimeout(update, 1000);
    }

    update();

    function iRunnerToMano_labs(container, storage) {
      /* For how long visited should remain green */
      const seconds = 60 * 30; // 30 minutes

      console.log('Visit elements: adding');
      container.noCore_added = true;
      var visited = localStorage.getItem('noCore_mano_groupsClisk');
      visited = visited ? JSON.parse(visited) : {};
      var groups = [...document.querySelectorAll('#mediate-inner>.with_arrow')];
      var time = new Date().getTime();
      for (let i = 0, l = groups.length; i < l; i++) {
        var el = groups[i];
        el.addEventListener('click', saveVisit);
        if (visited[i + 1] && time - visited[i + 1] < seconds * 1000) {
          createElement(el, true)
        }
        else {
          createElement(el, false)
        }
      };
      function saveVisit() {
        visited[[...this.parentNode.children].indexOf(this)] = new Date().getTime();
        localStorage.setItem('noCore_mano_groupsClisk', JSON.stringify(visited));
      }
      updateForGrades(storage);
      function updateForGrades(storage) {
        var container = document.querySelector('#mediate-inner>.with_arrow');
        if (container && container.noCore_added) {
          var year = document.querySelector('.date').innerText.match(/(\d{4}-\d{4}|\d{4})/g)[0];
          var st = storage[`${Number(year) - 1}–${year}`];
          var groups = [...container.parentNode.querySelectorAll('.el_var_block')];
          groups.forEach((gr) => {
            if (Object.keys(st[gr.innerText].exam).length > 2) {
              gr.querySelector('div:not([class])').style.border = '2px solid #23c100';
            }
          });
        }
      }
      console.log('Visit elements: added');
    }

    function iRunnerToMano_ExamsVisited(container, storage) {
      container.noCore_added = true;
      var groups = [...container.querySelectorAll('tbody>tr')];
      groups.forEach((gr) => {
        var group = gr.getAttribute('data-grupe') || gr.querySelector('*[data-title="Group code"]').innerText;
        group = group.replace(' ', '');
        var year = gr.getAttribute('data-mmetai') || gr.querySelector('*[data-title="Academic year"]').innerText;
        year = year.replace('-', '–');
        var stor = storage[year][group];
        if (stor && Object.keys(stor.exam).length > 2) {
          createElement(gr.children[0], false, true);
        }
      });
    }

    function iRunnerToMano_ExamsGrades(container, storage) {
      container.noCore_added = true;
      var putGrades = document.createElement('div');
      putGrades.innerHTML = 'Set Grades';
      putGrades.style = 'position: absolute;right: -138px;';
      putGrades.className = 'btn btn-default no-outline';
      putGrades.addEventListener('click', setGrades);
      document.querySelector('.btn-group').appendChild(putGrades);
      function setGrades() {
        var ar = [...document.querySelectorAll('.examGradeFromiRunner')];
        ar.forEach((grade) => {
          if (!grade.examNotAllowed) {
            grade.nextSibling.value = grade.innerText;
          }
        });
      }

      var year = document.getElementById('applyforallpicker').value.match(/(\d{4}-\d{4}|\d{4})/g)[0]
      var students = [...container.querySelectorAll('tbody>tr')];
      var st = storage[`${Number(year) - 1}–${year}`];
      students.forEach((student) => {
        var studentUID = student.querySelector('*[data-title="Student code"]') || student.children[0]; studentUID = studentUID.innerText;
        var surname = student.querySelector('*[data-title="Student name"]') || student.children[2]; surname = surname.innerText;
        var grade = student.querySelector('*[data-title="Full Credit"]') || student.children[5];
        grade = grade.querySelector('input[type="text"]');
        if (!grade) { return }
        for (let i = 0, l = st.groups.length; i < l; i++) {
          var g = st[st.groups[i]];
          var dom = document.createElement('a');
          dom.className = 'examGradeFromiRunner';
          dom.style = 'position: absolute;left: -8px;top: -8px;background: white;border: 1px solid gray;border-radius: 50%;width: 18px;height: 18px;';
          grade.parentNode.style.position = 'relative';
          grade.parentNode.insertBefore(dom, grade)

          if (g.exam.alloweduid[studentUID]) {
            var exam = g.exam[g.exam.alloweduid[studentUID]];
            dom.innerText = exam.grade;
            dom.title = `${exam.done}/${exam.total}`
            if (!exam.allowed) {
              dom.examNotAllowed = true;
              dom.style.color = 'red';
              dom.title += 'Labs are Not done';
            }
            return;
          }
          else {
            dom.innerText = 'P';
          }
        }
      })
    }

    function createElement(el, pass, hasMarks) {
      var dom = document.createElement('div');
      dom.style = 'width:10px;height:10px;border-radius: 50%;position: absolute;top: calc(50% - 5px);left: 4px;';
      dom.style.border = hasMarks ? '2px solid #23c100' : '1px solid gray';
      dom.style.background = pass ? '#75db75' : '#ddd';
      el.appendChild(dom);
      el.style.position = 'relative';
    }
  };

  /* === */

  /* =========================== CORE =================================== */

  function CORE() {
    const Core = {};

    Core.menu = new class Menu {
      // Menu buttons and menus
      constructor() {
        this.menuDom = document.querySelector('.navbar-nav');
      }
      createButton(name, url, order) {
        if (!this.menuDom) { return }
        var button = document.createElement('li');
        button.innerHTML = `<a target="_blank" href="/${url}">${name}</a>`;
        this.menuDom.insertBefore(button, this.menuDom.children[this.menuDom.children.length - order]);
      }
    }

    Core.style = new class Style {
      constructor() {
        this.head = document.head;
      }
      addStyle(id, css) {
        if (!css) { css = id; id = false; }
        if (id && this.head.querySelector('#' + id)) { return; }
        var style = document.createElement('style');
        style.innerHTML = css;
        if (id) { style.id = id; }
        this.head.appendChild(style);
      }
    }

    Core.page = new class Page {
      constructor() {

      }
      async getPage(url = "") {
        const response = await fetch(url);
        var page = await response.text();
        var parser = new DOMParser();
        var doc = parser.parseFromString(page, 'text/html');
        return doc;
      }
    }

    Core.browser = new class Browser {
      constructor() { }
      sendData(name, value) {
        GM.deleteValue(name);
        var request = {
          origin: unsafeWindow.location.href,
          data: value
        }
        GM.setValue(name, request)
      }
      addEventListener(eventName, callback) {
        function isProperWindow(eventName, del, newValue) {
          if (newValue && unsafeWindow.location.href !== newValue.origin) {
            this(newValue.data, newValue.origin);
          }
        }
        GM.addValueChangeListener(eventName, isProperWindow.bind(callback));
      }
    }

    Core.popup = function (text, uid = '', classN = '', timer = 10000) {
      var div = document.getElementById('PopUp_' + uid);
      var event = null;
      if (div) {
        event = div.eventMessage;
        if (div.id === 'PopUp_' + uid) {
          clearTimeout(div.timeOut);
          document.body.removeChild(div);
        }
        else {
          setTimeout(() => {
            div.setAttribute('style', `bottom:${div.clientHeight + 24}px !important`);
          }, 10);
        }
      };
      if (!text) { return; }
      div = document.createElement('div');
      div.id = 'PopUp_' + uid;
      //uid?div.UID = 'PopUp_'+uid:null;
      div.className = 'noCore_popup ' + classN;
      div.innerHTML = `<p>${text}</p>`;
      document.body.appendChild(div);
      div.timeOut = setTimeout(function () { document.body.removeChild(this) }.bind(div), timer)
      var button = [...div.querySelectorAll('button')];
      if (button.length > 1) {
        var dom = document.createElement('div');
        dom.className = 'buttons';
        div.appendChild(dom);
        button.forEach((b) => { dom.appendChild(b) });
      }
      function action(button) {
        this.eventMessage(button);
      }
      if (button.length > 0) {
        button.forEach((b) => {
          b.addEventListener('click', action.bind(div, b));
        })
      }
      return div;
    }

    Core.help = function (array) {
      var help = document.createElement('div');
      help.className = 'noCore_help';
      help.innerHTML = '❔';
      help.addEventListener('click', showHelp);
      document.body.appendChild(help);
      const messages = [...array];
      function showHelp() {
        var mess = messages.shift();
        if (mess) {
          var bottom = messages.length > 0 ? '<button>Next</button>' : '<button>Close</button>';
          var dom = Core.popup(mess + bottom, 'help', 'help', 9999999);
          dom.eventMessage = showHelp;
        }
        else {
          Core.popup(false, 'help');
        }
      }
    }

    checkForUpdate(Core);

    return Core;
  }



  /* Check For Updates */
  function checkForUpdate(noCore) {
    if (!updateCheck) { return };
    var lastTry = localStorage.getItem('VGTUProfessoring_updateTry');
    if (lastTry) {
      lastTry = Math.ceil((new Date().getTime() - new Date(JSON.parse(lastTry)).getTime()) / 1000 / 60 / 60 / 24) - 1;
    }
    else {
      localStorage.setItem('VGTUProfessoring_updateTry', JSON.stringify(new Date()))
      lastTry = 0;
    }
    if (lastTry < 1) { return }
    fetch(checkUrl)
      .then(response => response.text())
      .then(data => {
        const match = data.match(/@version\s+(\d+\.\d+)/);
        if (match) {
          const githubVersion = parseFloat(match[1]);
          const currentVersion = parseFloat(GM_info.script.version);

          if (githubVersion > currentVersion) {
            var pop = noCore.popup('VGTUProfessoring \nNew version available.<button>Update</button><button>Cancel</button>', 'update', '', 10);
            pop.eventMessage = function (button) {
              noCore.popup(false);
              var responce = button.innerText;
              if (responce === 'Update') {
                window.location.replace(scriptUrl);
              }
              else {
                localStorage.setItem('VGTUProfessoring_updateTry', JSON.stringify(new Date()));
              }
            }

          } else {
            console.log('VGTUProfessoring: You have the latest version of the script.');
          }
        } else {
          console.error('VGTUProfessoring: Unable to extract version from the GitHub script.');
        }
      })
      .catch(error => {
        console.error('VGTUProfessoring: Error checking for updates:', error);
      });
  }
})();
