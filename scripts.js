var version = "v2";
var fileVersion = '20200429.1';

var fileList = {
  'ItemName': 'data/en/ItemName.json?ver=' + fileVersion,
  'ArtifactName': 'data/en/ArtifactName.json?ver=' + fileVersion,
  'ItemImageMap': 'data/ItemImageMap.json?ver=' + fileVersion,
  'ItemQuests': 'data/ItemQuests.json?ver=' + fileVersion,
  'QuestsByIName': 'data/QuestsByIName.json?ver=' + fileVersion,
  'ElementalItems': 'data/ElementalItems.json?ver=' + fileVersion,
  'JobMaterials': 'data/JobMaterials.json?ver=' + fileVersion,
  'Characters': 'data/Characters.json?ver=' + fileVersion,
  'ItemRecipes': 'data/ItemRecipes.json?ver=' + fileVersion,
};

var loadedData = {};

for (let [key, url] of Object.entries(fileList)) {
  fetch(url)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      loadedData[key] = data;
    });
}

let preload = null;
$(document).ready(function () {
  preload = setInterval(function () {
    if (Object.keys(fileList).length === Object.keys(loadedData).length) {
      start();
    }
  }, 100);
});

var materialsList = [];
var autocompleteData = [];
var translation = {};
var templates = {};
var filterOptions = [];

/**
 * Initializes and starts the application.
 */
function start() {
  clearInterval(preload);

  initTranslation();
  initTemplates();
  initTypeAhead();
  initDarkMode();
  initUI();

  loadFromLocalStorage();

  importFromQueryString();

  initFiltering();

  calculate();

  $('.loading').hide();
  $('.main').show();
}


/**
 * Handles when an item is selected in the autocomplete.
 *
 * @param e
 * @param suggestion
 */
function onTypeaheadSelect(e, suggestion) {
  var $typeahead = $('.typeahead');
  $typeahead.typeahead('val', '');
  $typeahead.focus();

  switch (suggestion.type) {
    case 'item':
      addMaterial(suggestion);
      break;
    case 'character':
      addCharacterMaterials(suggestion);
      break;
    case 'job':
      addJobMaterials(suggestion);
      break;
    case 'recipe':
      addRecipeMaterials(suggestion);
      break;
  }
}

/**
 * Adds a material to the tracking array and the DOM.
 *
 * @param material - string or material object.
 * @param dontCalculate
 */
function addMaterial(material, dontCalculate) {
  // Normalize structure.
  if (typeof material === 'string') {
    material = {
      iname: material,
      value: translation['ItemName'][material]
    }
  }

  if (materialsList.includes(material.iname)) {
    return;
  }

  materialsList.push(material.iname);
  addMaterialToDom(material);

  updateLocalStorage();
  if (!dontCalculate) {
    calculate();
  }
}

/**
 * Updates the DOM to show the passed material.
 *
 * @param material
 */
function addMaterialToDom(material) {
  var materialItem = applyTemplate('MaterialItem', {
    'material': material.iname,
    'materialLabel': getMaterialImageOrLabel(material, true),
  });

  $('.materials-list').append(materialItem);
}

/**
 * Adds all materials related to a job name.
 *
 * @param job - string or job object.
 */
function addJobMaterials(job) {
  // Normalize structure.
  if (typeof job === 'string') {
    job = {
      iname: job,
      value: job
    }
  }

  if (!loadedData['JobMaterials'].hasOwnProperty(job.iname)) {
    return;
  }

  loadedData['JobMaterials'][job.iname].forEach(addMaterial);
}

/**
 * Adds all materials related to a character name.
 *
 * @param charName
 */
function addCharacterMaterials(charName) {
  if (!loadedData['Characters'].hasOwnProperty(charName.iname)) {
    return;
  }

  // First prop is the character element.
  addElementMaterials(loadedData['Characters'][charName.iname].element);

  // Rest of the props are job names.
  loadedData['Characters'][charName.iname].jobs.forEach(addJobMaterials);
}

/**
 * Adds all materials related to an element.
 *
 * @param elementName
 */
function addElementMaterials(elementName) {
  if (!loadedData['ElementalItems'].hasOwnProperty(elementName)) {
    return;
  }

  loadedData['ElementalItems'][elementName].forEach(addMaterial);
}

/**
 * Adds all materials related to an equipment name.
 *
 * @param recipe
 */
function addRecipeMaterials(recipe) {
  if (!loadedData['ItemRecipes'].hasOwnProperty(recipe.iname)) {
    return;
  }

  loadedData['ItemRecipes'][recipe.iname].forEach(addMaterial);
}

/**
 * Gets the material's img element or a text label if no image available.
 *
 * @param material
 * @param includeText
 * @param includeRange
 */
function getMaterialImageOrLabel(material, includeText, includeRange) {
  if (!loadedData['ItemImageMap'].hasOwnProperty(material.iname)) {
    return material.iname;
  }

  // We don't have images for all materials, so return the label if empty.
  if (!loadedData['ItemImageMap'][material.iname]) {
    return material.iname;
  }

  // Coerce the image layers to be uniformly arrays.
  var layers = loadedData['ItemImageMap'][material.iname];
  if (!Array.isArray(loadedData['ItemImageMap'][material.iname])) {
    layers = [loadedData['ItemImageMap'][material.iname]];
  }

  var layerHtml = '';
  layers.forEach(function (layer) {
    layerHtml += getMaterialLayerImageHtml(material, layer);
  });

  if (includeRange) {
    var showRange = (material.min !== material.max);

    layerHtml += applyTemplate('MaterialQuantityLayer', {
      'material': material.value,
      'min': material.min,
      'max': material.max,
      'showRange': showRange,
    });
  }

  return applyTemplate('MaterialIconWrapper', {
    'layers': layerHtml,
    'includedText': includeText ? material.value : ''
  });
}

/**
 * Defines a utility function to build a single material icon layer.
 *
 * @param material
 * @param image
 * @returns {string}
 */
function getMaterialLayerImageHtml(material, image) {
  var typeClass = '';
  if (image.indexOf('job/') >= 0) {
    typeClass = 'material-icon-job';
  }
  if (image.indexOf('gear/') >= 0) {
    typeClass = 'material-icon-gear';
  }
  if (image.indexOf('_recipe') >= 0) {
    typeClass = 'material-icon-recipe';
  }
  if (image.indexOf('itemicon_job_') >= 0) {
    typeClass = 'material-icon-memory';
  }
  if (image.indexOf('it_pi_lw_') >= 0) {
    typeClass = 'material-icon-shard';
  }

  return applyTemplate('MaterialIconLayer', {
    'image': image,
    'typeClass': typeClass,
    'material': material.value
  });
}

/**
 * Deletes material from array and DOM.
 */
function deleteMaterial() {
  var $parent = $(this).parents('.input-group').first();
  var material = $parent.data('material');
  $parent.remove();
  materialsList.splice(materialsList.findIndex(a => a === material), 1);
  updateLocalStorage();
  calculate();
}

/**
 * Takes the list of materials and figures out which quests match.
 */
function calculate() {
  if (!materialsList.length) {
    return;
  }

  // First, get all quest inames for all item inames (taking counts for in-common materials)
  var inCommon = {};
  materialsList.forEach(function (materialListItem) {
    if (!loadedData['ItemQuests'].hasOwnProperty(materialListItem)) {
      console.warn("Missing itemQuests for material: ", materialListItem);
      return;
    }

    var itemQuests = loadedData['ItemQuests'][materialListItem];

    itemQuests.forEach(function (itemQuest) {
      if (!inCommon.hasOwnProperty(itemQuest)) {
        inCommon[itemQuest] = [];
      }
      inCommon[itemQuest].push(materialListItem);
    });
  });

  // Second, sort quest inames by # of in-common materials
  var inCommonSorted = {};
  let sortedKeys = Object.keys(inCommon).sort(function (a, b) {
    return inCommon[b].length - inCommon[a].length;
  });
  sortedKeys.forEach(function (key) {
    inCommonSorted[key] = inCommon[key];
  });
  inCommon = inCommonSorted;

  var $tbody = $('.quest-list tbody');
  $tbody.html('');

  for (let [questIName, matchedItems] of Object.entries(inCommon)) {
    var questRowVM = {};

    var quest = loadedData['QuestsByIName'][questIName];
    if (!quest) {
      console.error("Unable to find quest for quest iname: ", questIName, quest);
      continue;
    }

    if (quest.start && quest.start > Date.now()) {
      console.info('quest start check failed: ', questIName, quest.start);
      continue;
    }

    if (quest.end && quest.end < Date.now()) {
      console.info('quest end check failed: ', questIName, quest.end);
      continue;
    }

    var startDate = '';
    var endDate = '';
    if (quest.start) {
      startDate = (new Date(quest.start)).toLocaleString();
    }

    if (quest.end) {
      endDate = (new Date(quest.end)).toLocaleString();
    }

    questRowVM.iname = questIName;
    questRowVM.type = quest.type;
    questRowVM.designation = quest.designation;
    questRowVM.title = quest.title;
    questRowVM.numEnemies = quest.numEnemies;
    questRowVM.numChests = quest.numChests;
    questRowVM.nrg = quest.nrg;
    questRowVM.xp = quest.unitXp;
    questRowVM.jp = quest.jp;
    questRowVM.gold = quest.gold;
    questRowVM.start = startDate;
    questRowVM.end = endDate;

    questRowVM.materialDropBoxes = "";
    matchedItems.forEach(function (matchedItem) {
      var matchedItemVM = {};
      matchedItemVM.dropChance = quest.topLevelDrop[matchedItem].dropChance;

      var entry = {
        'iname': matchedItem,
        'value': translation['ItemName'][matchedItem],
        'type': 'item',
        'min': quest.topLevelDrop[matchedItem].min,
        'max': quest.topLevelDrop[matchedItem].max,
      };
      matchedItemVM.materialLabel = getMaterialImageOrLabel(entry, false, true);
      questRowVM.materialDropBoxes += applyTemplate('MaterialDropBox', matchedItemVM);
    });

    $tbody.append(applyTemplate('QuestRow', questRowVM));

    for (let [dropTableKey, setData] of Object.entries(quest.drop)) {
      var questRowExpandedVM = {};
      questRowExpandedVM.iname = questIName;

      questRowExpandedVM.enemies = [];

      // Don't show tables without anything that can drop it.
      if (!setData.enemies || setData.enemies.length === 0) {
        continue;
      }

      setData.enemies.forEach(function (enemyData) {
        if (!enemyData.name) {
          enemyData.name = enemyData.iname;
        }
        var elementImage = "element/element_icon_none.png";
        var element = "Element: None";
        if (enemyData.elem) {
          elementImage = "img/element/element_icon_" + enemyData.elem.toLowerCase() + ".png";
          element = "Element: " + enemyData.elem;
        }
        questRowExpandedVM.enemies.push({
          name: enemyData.name,
          elementImage: elementImage,
          element: element,
        });
      });

      questRowExpandedVM.materialDropBoxes = "";
      setData.drops.forEach(function (itemData) {
        var matchedItemVM = {};
        matchedItemVM.dropChance = Number(itemData.chance);
        var entry = {
          'iname': itemData.iname === "NOTHING" ? applyTemplate('NoDrop', {}) : itemData.iname,
          'value': itemData.name,
          'min': itemData.num,
          'max': itemData.num,
          'type': 'item',
        };

        matchedItemVM.materialLabel = getMaterialImageOrLabel(entry, false, true);
        questRowExpandedVM.materialDropBoxes += applyTemplate('MaterialDropBox', matchedItemVM);
      });

      $tbody.append(applyTemplate('QuestRowExpanded', questRowExpandedVM));
    }
  }

  applyFiltering();
}

/**
 * Clears all selected materials from array, localStorage, and DOM.
 */
function clearAll() {
  if (!confirm('Are you sure you want to clear all selected materials?')) {
    return;
  }

  $('.materials-list').html('');
  materialsList = [];
  $('.quest-list tbody').html('');

  updateLocalStorage();
}

/**
 * Stores the selected materials in local storage.
 */
function updateLocalStorage() {
  localStorage.setItem(version + '.selectedMaterials', JSON.stringify(materialsList));
  localStorage.setItem(version + '.filterOptions', JSON.stringify($('.quest-filters-form').serializeArray()));
}

/**
 * Load the selected materials from local storage.
 */
function loadFromLocalStorage() {
  var savedFilterOptions = localStorage.getItem(version + '.filterOptions');
  if (savedFilterOptions) {
    filterOptions = JSON.parse(savedFilterOptions);
  }

  var savedMaterials = localStorage.getItem(version + '.selectedMaterials');
  if (!savedMaterials) {
    return;
  }

  var list = JSON.parse(savedMaterials);
  if (!list.length) {
    return;
  }

  list.forEach(function (listItem) {
    addMaterial(listItem, true);
  });
}

/**
 * Parses the list of materials and adds them as materials to search on.
 *
 * @param importList
 */
function doImport(importList) {
  importList = importList.trim();
  if (!importList) {
    return;
  }

  var shouldReverseTranslate = false;
  if (importList.indexOf('IT_') === -1) {
    shouldReverseTranslate = true;
  }

  importList = importList.split(',');

  importList.forEach(function (importMaterial) {
    importMaterial = importMaterial.trim();
    if (shouldReverseTranslate && translation['ReverseLookup'][importMaterial]) {
      // Add material by english translated name.
      addMaterial(translation['ReverseLookup'][importMaterial]);
      return;
    }

    // Add material by item iname.
    // Only add material if it is a valid material we are tracking.
    // We can use ItemImageMap for this since even items without images are declared.
    if (!loadedData['ItemImageMap'].hasOwnProperty(importMaterial)) {
      return;
    }

    addMaterial(importMaterial);
  });

  updateLocalStorage();
}

/**
 * Parses a passed list of items
 */
function importFromQueryString() {
  var urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('i')) {
    return;
  }

  var items = urlParams.get('i');
  doImport(items);
}

/**
 * Populates the export textarea with current list of materials.
 */
function populateExport() {
  $('#export').text(materialsList.join(','));

  var reverseMaterialsList = [];
  materialsList.forEach(function (material) {
    var reversed = translation['ItemName'][material];
    if (!reversed) {
      reversed = translation['ItemName'][material];
    }

    if (reversed) {
      reverseMaterialsList.push(reversed);
    }
  });

  $('#exportName').text(reverseMaterialsList.join(','));
}

/**
 * For a given template, populate the template then return the HTML to be
 * inserted.
 *
 * @returns {*}
 */
function applyTemplate(template, data) {
  return templates[template](data);
}

/**
 * Initialize the autocomplete functionality.
 */
function initTypeAhead() {
  // Build the structure for the autocomplete.
  Object.keys(loadedData["ItemQuests"]).forEach(function (itemCode) {
    var entry = {
      'iname': itemCode,
      'value': translation['ItemName'][itemCode],
      'type': 'item',
    };
    entry.materialLabel = getMaterialImageOrLabel(entry, true);
    autocompleteData.push(entry);
  });

  Object.keys(loadedData["Characters"]).forEach(function (characterName) {
    var entry = {
      'iname': characterName,
      'value': 'Character: ' + characterName,
      'type': 'character',
      'materialLabel': 'Character: ' + characterName,
    };
    autocompleteData.push(entry);
  });

  Object.keys(loadedData["JobMaterials"]).forEach(function (jobName) {
    var entry = {
      'iname': jobName,
      'value': 'Job: ' + jobName,
      'type': 'job',
      'materialLabel': 'Job: ' + jobName,
    };
    autocompleteData.push(entry);
  });

  Object.keys(loadedData["ItemRecipes"]).forEach(function (artifactIName) {
    var entry = {
      'iname': artifactIName,
      'value': 'Equipment: ' + translation['ArtifactName'][artifactIName],
      'type': 'recipe',
      'materialLabel': 'Equipment: ' + translation['ArtifactName'][artifactIName],
    };
    autocompleteData.push(entry);
  });


  var autocompleteBH = new Bloodhound({
    datumTokenizer: Bloodhound.tokenizers.obj.nonword('value'),
    queryTokenizer: Bloodhound.tokenizers.nonword,
    //identify: function(obj) { return obj.value; },
    local: autocompleteData
  });

  $('.typeahead').typeahead({
      hint: true,
      highlight: true,
      minLength: 1,
    },
    {
      limit: 50,
      name: 'items',
      source: autocompleteBH,
      display: 'value',
      templates: {
        empty: '<div class="empty-message">Nothing found.</div>',
        suggestion: templates['MaterialTypeahead'],
      }
    }
  );

  $('.typeahead').on('typeahead:select', onTypeaheadSelect);
}

/**
 * Initialize the various templates that are used.
 */
function initTemplates() {
  Handlebars.registerHelper('cssclass', function (aString) {
    return aString.toLowerCase().replace(' ', '-').replace('\'', '');
  });

  var templateSelectors = {
    'MaterialItem': '.template-material-item',
    'MaterialIconLayer': '.template-material-icon-layer',
    'MaterialIconWrapper': '.template-material-icon-wrapper',
    'MaterialTypeahead': '.template-material-typeahead',
    'MaterialDropBox': '.template-material-drop-box',
    'QuestRow': '.template-quest-row',
    'QuestRowExpanded': '.template-quest-row-expanded',
    'NoDrop': '.template-no-drop',
    'MaterialQuantityLayer': '.template-material-quantity-layer',
  };

  for (let [key, selector] of Object.entries(templateSelectors)) {
    var $template = $(selector);
    templates[key] = Handlebars.compile($template.html());
  }
}

/**
 * Initializes the translation lookup information.
 */
function initTranslation() {
  var translationKeys = [
    'ItemName',
    'ArtifactName',
  ];
  translationKeys.forEach(function (translationKey) {
    translation[translationKey] = {};
    loadedData[translationKey]['infos'].forEach(function (keyValue) {
      translation[translationKey][keyValue.key] = keyValue.value;
    });
  });

  // Build a reverse translation lookup for import/export.
  translation['ReverseLookup'] = {};
  for (let [key, value] of Object.entries(translation['ArtifactName'])) {
    translation['ReverseLookup'][value] = key;
  }
  for (let [key, value] of Object.entries(translation['ItemName'])) {
    translation['ReverseLookup'][value] = key;
  }
}

/**
 * Initializes and loads the dark mode functionality.
 */
function initDarkMode() {
  var $body = $('body');
  $body.on('click', '.toggle-dark-mode', function (e) {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $body.addClass('dark-mode');
    localStorage.setItem('darkMode', '1');
  });

  $body.on('click', '.toggle-light-mode', function (e) {
    $('.toggle-dark-mode').show();
    $('.toggle-light-mode').hide();
    $body.removeClass('dark-mode');
    localStorage.setItem('darkMode', '');
  });

  if (localStorage.getItem('darkMode') === '1') {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $body.addClass('dark-mode');
  }
}

/**
 * Initializes the interactive elements.
 */
function initUI() {
  var $body = $('body');
  $body.on('click', '.materials-list .btn-close', deleteMaterial);
  $body.on('click', '.btn-clear-all', clearAll);
  $body.on('click', '.btn-export', populateExport);

  // Toggle showing drop tables.
  $body.on('click', '.accordion-toggle-quest-name', function () {
    var questIName = $(this).data('quest');
    if ($(this).attr('src') === 'img/ui/cmn_btn_acordion_off.png') {
      $(this).attr('src', 'img/ui/cmn_btn_acordion_on.png');
      $('.quest-row-expanded-' + questIName).show();
    } else {
      $(this).attr('src', 'img/ui/cmn_btn_acordion_off.png');
      $('.quest-row-expanded-' + questIName).hide();
    }
  });

  // Toggle showing individual drop table.
  $body.on('click', '.accordion-toggle-drop-table', function () {
    if ($(this).attr('src') === 'img/ui/cmn_btn_acordion_off.png') {
      $(this).attr('src', 'img/ui/cmn_btn_acordion_on.png');
      $(this).parent().siblings('.drop-table-data').show();
    } else {
      $(this).attr('src', 'img/ui/cmn_btn_acordion_off.png');
      $(this).parent().siblings('.drop-table-data').hide();
    }
  });

  // Handle mode tab active class change.
  $body.on('click', '.nav-main a', function (e) {
    e.preventDefault();
    $('.nav-main a').removeClass('active');
    $(this).addClass('active');
  });

  $body.on('click', '.nav-search', function (e) {
    e.preventDefault();
    $('.mode').hide();
    $('.mode-autocomplete').show();
    $('.typeahead').focus();
  });

  $body.on('click', '.nav-import', function (e) {
    e.preventDefault();
    $('.mode').hide();
    $('.mode-import').show();
    $('#import').focus();
  });

  $body.on('click', '.nav-export', function (e) {
    e.preventDefault();
    $('.mode').hide();
    $('.mode-export').show();
    populateExport();
  });

  $body.on('click', '.btn-mode-cancel', function (e) {
    e.preventDefault();
    $('.mode').hide();
    $('.mode-autocomplete').show();
    $('.nav-main a').removeClass('active');
    $('.nav-main a:first-child').addClass('active');
    $('.autocomplete__input').focus();
  });

  $body.on('click', '.btn-import', function (e) {
    e.preventDefault();
    doImport($('#import').val());
    calculate();
    $('.mode-autocomplete').show();
    $('.mode-import').hide();
    $('.nav-main a').removeClass('active');
    $('.nav-main a:first-child').addClass('active');
  });
}

/**
 * Attaches handlers and processes quest filter inputs.
 */
function initFiltering() {
  filterOptions.forEach(function (filterOption) {
    var $field = $('[name=' + filterOption.name + ']');
    if ($field[0].type == "radio" || $field[0].type == "checkbox") {
      var $fieldWithValue = $field.filter('[value="' + filterOption.value + '"]');
      var isFound = ($fieldWithValue.length > 0);
      if (!isFound && filterOption.value == "on") {
        $field.first().prop("checked", true);
      } else {
        $fieldWithValue.prop("checked", isFound);
      }
    } else { // input, textarea
      $field.val(filterOption.value);
    }

  });

  $('body').on('click', '.quest-type-checkboxes input[type=checkbox]', function (e) {
    applyFiltering();
  });

  $('body').on('click', '.btn-filter-clear', function (e) {
    $('#questFiltersForm').trigger('reset');
    applyFiltering();
    $('.btn-filter-clear').hide();
  });
}

/**
 * Reads the quest filter form state and applies filtering to the quest list.
 */
function applyFiltering() {
  updateLocalStorage();

  // Default to show everything then hide with filters.
  $('.quest-row').show();

  var checked = $('.quest-type-checkboxes input[type=checkbox]:checked');

  if (checked.length > 0) {
    $('.btn-filter-clear').show();

    checked.each(function (index, checkbox) {
      $('.quest-row-type-' + $(checkbox).val()).hide();
    });
  }

  // @todo: add other types of filtering here.
}
