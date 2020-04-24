var version = "v2";

var fileList = {
  'ItemName': 'data/en/ItemName.json',
  'ArtifactName': 'data/en/ArtifactName.json',
  'ItemImageMap': 'data/ItemImageMap.json',
  'ItemAtLeastOne': 'data/ItemAtLeastOne.json',
  'ItemChance': 'data/ItemChance.json',
  'ItemQuests': 'data/ItemQuests.json',
  'QuestsByIName': 'data/QuestsByIName.json',
  'ElementalItems': 'data/ElementalItems.json',
  'JobMaterials': 'data/JobMaterials.json',
  'Characters': 'data/Characters.json',
  'ItemRecipes': 'data/ItemRecipes.json',
  'QuestAtLeastOne': 'data/QuestAtLeastOne.json',
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

function start() {
  clearInterval(preload);

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

  initTemplates();

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

  initTypeAhead();

  $('.typeahead').on('typeahead:select', handleCallback);

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

  $body.on('click', '.materials-list .btn-close', deleteMaterial);
  $body.on('click', '.btn-clear-all', clearAll);

  // Toggle showing drop tables.
  $body.on('click', '.accordion-toggle-story-name', function () {
    var questIName = $(this).data('quest');
    if ($(this).attr('src') === 'img/ui/cmn_btn_acordion_off.png') {
      $(this).attr('src', 'img/ui/cmn_btn_acordion_on.png');
      $('.story-row-expanded-' + questIName).show();
    } else {
      $(this).attr('src', 'img/ui/cmn_btn_acordion_off.png');
      $('.story-row-expanded-' + questIName).hide();
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

  loadFromLocalStorage();

  $('.loading').hide();
  $('.main').show();
}


/**
 *
 * @param e
 * @param suggestion
 */
function handleCallback(e, suggestion) {
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
 *
 *
 * @param material
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
 * Add all materials related to a job name.
 *
 * @param job
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
 * Add all materials related to a character name.
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
 * Add all materials related to an element.
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
 * Add all materials related to an equipment name.
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
 * Gets the material's img element or a text label if no image available.
 *
 * @param material
 * @param includeText
 * @param includeQuantity
 */
function getMaterialImageOrLabel(material, includeText, includeQuantity) {
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

  if (includeQuantity) {
    layerHtml += applyTemplate('MaterialQuantityLayer', {
      'material': material.value,
      'quantity': material.quantity,
    });
  }

  var html = applyTemplate('MaterialIconWrapper', {
    'layers': layerHtml,
    'includedText': includeText ? material.value : ''
  });

  return html;
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
 * Delete material from array and DOM.
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
 * Take the list of materials and figure out which story quests match.
 */
function calculate() {
  if (!materialsList.length) {
    $('.feedback').html('<div class="alert alert-danger" role="alert">Add materials first.</div>');
    return;
  }

  $('.feedback').html('');

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

  var $tbody = $('.story-quest-list tbody');
  $tbody.html('');

  for (let [questIName, matchedItems] of Object.entries(inCommon)) {
    var storyRowVM = {};

    var quest = loadedData['QuestsByIName'][questIName];
    if (!quest) {
      console.error("Unable to find quest for quest iname: ", questIName, quest);
      break;
    }

    storyRowVM.iname = questIName;
    storyRowVM.type = quest.type;
    storyRowVM.designation = quest.designation;
    storyRowVM.title = quest.title;
    storyRowVM.numEnemies = quest.numEnemies;
    storyRowVM.numChests = quest.numChests;
    storyRowVM.nrg = quest.nrg;
    storyRowVM.xp = quest.unitXp;
    storyRowVM.jp = quest.jp;
    storyRowVM.gold = quest.gold;

    storyRowVM.materialDropBoxes = "";
    matchedItems.forEach(function (matchedItem) {
      var matchedItemVM = {};
      // @todo: There can be multiple drop chances here - how to flatten?
      // @todo: For now just take the first which is the highest.
      matchedItemVM.dropChance = loadedData['QuestAtLeastOne'][questIName][matchedItem][0];
      var entry = {
        'iname': matchedItem,
        'value': translation['ItemName'][matchedItem],
        'type': 'item',

        // @todo: show quantity here?
        //'quantity':
      };
      matchedItemVM.materialLabel = getMaterialImageOrLabel(entry, false);
      storyRowVM.materialDropBoxes += applyTemplate('MaterialDropBox', matchedItemVM);
    });

    $tbody.append(applyTemplate('StoryRow', storyRowVM));

    for (let [dropKey, setData] of Object.entries(quest.drop)) {
      var storyRowExpandedVM = {};
      storyRowExpandedVM.iname = questIName;

      storyRowExpandedVM.enemies = [];
      setData.enemies.forEach(function(enemyData) {
        if (!enemyData.name) {
          enemyData.name = enemyData.iname;
        }
        var elementImage = "element/element_icon_none.png";
        var element = "Element: None";
        if (enemyData.elem) {
          elementImage = "img/element/element_icon_" + enemyData.elem.toLowerCase() + ".png";
          element = "Element: " + enemyData.elem;
        }
        storyRowExpandedVM.enemies.push({
          name: enemyData.name,
          elementImage: elementImage,
          element: element,
        });
      });

      storyRowExpandedVM.materialDropBoxes = "";
      for (let [itemIName, itemData] of Object.entries(setData.drops)) {
        var matchedItemVM = {};
        matchedItemVM.dropChance = itemData.chance + "%";
        var entry = {
          'iname': itemIName === "NOTHING" ? applyTemplate('NoDrop', {}) : itemIName,
          'value': itemData.name,
          'quantity': itemData.num,
          'type': 'item',
        };

        matchedItemVM.materialLabel = getMaterialImageOrLabel(entry, false, true);
        storyRowExpandedVM.materialDropBoxes += applyTemplate('MaterialDropBox', matchedItemVM);
      }

      $tbody.append(applyTemplate('StoryRowExpanded', storyRowExpandedVM));
    }
  }
}

/**
 * Clear all selected materials from array, localStorage, and DOM.
 */
function clearAll() {
  if (!confirm('Are you sure you want to clear all selected materials?')) {
    return;
  }

  $('.materials-list').html('');
  materialsList = [];
  $('.story-quest-list tbody').html('');

  updateLocalStorage();
}

/**
 * Store the selected materials in local storage.
 */
function updateLocalStorage() {
  localStorage.setItem(version + '.selectedMaterials', JSON.stringify(materialsList));
}

/**
 * Load the selected materials from local storage.
 */
function loadFromLocalStorage() {
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
  calculate();
}

/**
 * Parses the list of materials and adds them as materials to search on.
 */
function doImport() {
  // @todo: Update/add back to beta
  var importList = $('#import').val();
  if (!importList) {
    return;
  }

  importList = importList.split(',');
  importList.forEach(function (importMaterial) {
    addMaterial(importMaterial);
  });

  updateLocalStorage();
}

/**
 * Populates the export textarea with current list of materials.
 */
function populateExport() {
  // @todo: Update/add back to beta
  $('#export').text(materialsList.join(','));
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
    });
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
    'StoryRow': '.template-story-row',
    'StoryRowExpanded': '.template-story-row-expanded',
    'NoDrop': '.template-no-drop',
    'MaterialQuantityLayer': '.template-material-quantity-layer',
  };

  for (let [key, selector] of Object.entries(templateSelectors)) {
    var $template = $(selector);
    templates[key] = Handlebars.compile($template.html());
  }


}
