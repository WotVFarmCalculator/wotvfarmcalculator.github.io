var version = "v2";

var fileList = {
  'ItemName': 'data/en/ItemName.json',
  'ArtifactName': 'data/en/ArtifactName.json',
  'ItemImageMap': 'data/ItemImageMap.json',
  'ItemQuests': 'data/ItemQuests.json',
  'QuestsByIName': 'data/QuestsByIName.json',
  'ElementalItems': 'data/ElementalItems.json',
  'JobMaterials': 'data/JobMaterials.json',
  'Characters': 'data/Characters.json',
  'ItemRecipes': 'data/ItemRecipes.json',
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
$(function () {
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
var requiredMaterial = null;
var showStealable = false;

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
  importFromQueryString();
  loadFromLocalStorage();
  rebuildMaterialsDom();
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

  $typeahead.trigger('focus');
}

/**
 * Adds a material to the tracking array and the DOM.
 *
 * @param material - string or material object.
 * @param dontCalculate
 */
function addMaterial(material, dontCalculate) {
  material = registerMaterial(material);
  if (!material) {
    return;
  }

  addMaterialToDom(material);

  updateLocalStorage();
  if (!dontCalculate) {
    calculateStart();
  }
}

/**
 * Save the material to the internal materials list, but don't add to DOM (yet).
 *
 * @param material
 * @returns {{value: *, iname: string}|boolean}
 */
function registerMaterial(material) {
  material = normalizeMaterial(material);

  if (materialsList.includes(material.iname)) {
    return false;
  }

  materialsList.push(material.iname);

  return material;
}

/**
 * Normalize the material object structure.
 *
 * @param material
 * @returns {{value: *, iname: string}}
 */
function normalizeMaterial(material) {
  // Normalize structure.
  if (typeof material === 'string') {
    material = {
      iname: material,
      value: translation['ItemName'][material]
    }
  }

  return material;
}

/**
 * Clear the DOM for the materials and rebuilds it based on internal materials list.
 */
function rebuildMaterialsDom() {
  $('.materials-list').empty();

  materialsList.forEach(function (materialIName) {
    var material = normalizeMaterial(materialIName);
    addMaterialToDom(material);
  });

  if (requiredMaterial) {
    if (materialsList.includes(requiredMaterial)) {
      var $requiredMaterial = $('.material-item-input[data-material=' + requiredMaterial + '] .required-material');
      if ($requiredMaterial.length > 0) {
        $requiredMaterial.attr('src', 'img/ui/summonquest_icon_rarelity_on.png');
        $requiredMaterial.parent().addClass('input-group-text-required');
      }
    }
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
    'materialLabel': getMaterialImageOrLabel(material, true, false, false),
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
function getMaterialImageOrLabel(material, includeText, includeRange, isSteal) {
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

  if (isSteal) {
    layerHtml += applyTemplate('MaterialStealLayer', {
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
  if (material === requiredMaterial) {
    requiredMaterial = null;
  }
  updateLocalStorage();
  calculateStart();
}

function calculateStart() {
  // For small numbers of materials, don't worry about showing the modal.
  if (!requiredMaterial && materialsList.length > 10) {
    $('#calculatingModal').modal('show');
  }

  // Offset 1 frame so that the modal appears before crunching numbers.
  setTimeout(function () {
    calculate();
  }, 1);
}


/**
 * Takes the list of materials and figures out which quests match.
 */
function calculate() {
  updateQuestFilterInfo();

  if (!materialsList.length) {
    return;
  }

  // Validate requiredMaterial is in the list of materials (just in case).
  if (!materialsList.includes(requiredMaterial)) {
    requiredMaterial = null;
  }

  var requiredQuests = null
  if (requiredMaterial) {
    requiredQuests = [];
    if (loadedData['ItemQuests'].drop.hasOwnProperty(requiredMaterial)) {
      requiredQuests = requiredQuests.concat(loadedData['ItemQuests'].drop[requiredMaterial]);
    }

    if (showStealable && loadedData['ItemQuests'].steal.hasOwnProperty(requiredMaterial)) {
      requiredQuests = requiredQuests.concat(loadedData['ItemQuests'].steal[requiredMaterial]);
    }

    // Remove duplicates.
    requiredQuests = requiredQuests.filter((value, index, self) => {
      return self.indexOf(value) === index;
    });
  }

  // First, get all quest inames for all item inames (taking counts for in-common materials)
  var inCommonQuestItems = {};
  materialsList.forEach(function (materialListItem) {
    if (!loadedData['ItemQuests'].drop.hasOwnProperty(materialListItem) && !loadedData['ItemQuests'].steal.hasOwnProperty(materialListItem)) {
      console.warn("Missing itemQuests for material: ", materialListItem);
      return;
    }

    var itemDropQuests = loadedData['ItemQuests'].drop[materialListItem];

    itemDropQuests.forEach(function (itemQuestIName) {
      // Filter out any quest that doesn't have the required material.
      if (requiredQuests && !requiredQuests.includes(itemQuestIName)) {
        return;
      }

      if (!inCommonQuestItems.hasOwnProperty(itemQuestIName)) {
        inCommonQuestItems[itemQuestIName] = {};
      }

      if (inCommonQuestItems[itemQuestIName].hasOwnProperty(materialListItem)) {
        console.warn('inCommonQuestItems Quest already has registered item: ', itemQuestIName, materialListItem);
      }

      var min = getTopLevelQuestItemParam(itemQuestIName, materialListItem, 'min');
      var max = getTopLevelQuestItemParam(itemQuestIName, materialListItem, 'max');
      var median = (min + max) / 2;

      inCommonQuestItems[itemQuestIName][materialListItem] = {
        'dropChance': getTopLevelQuestItemParam(itemQuestIName, materialListItem, 'dropChance'),
        'num': median,
        'type': 'drop',
      };
    });

    if (!showStealable) {
      return;
    }

    var itemStealQuests = [];
    if (showStealable && loadedData['ItemQuests'].steal.hasOwnProperty(materialListItem)) {
      itemStealQuests = loadedData['ItemQuests'].steal[materialListItem];
    }
    itemStealQuests.forEach(function (itemQuestIName) {
      // Filter out any quest that doesn't have the required material.
      if (requiredQuests && !requiredQuests.includes(itemQuestIName)) {
        return;
      }

      if (!inCommonQuestItems.hasOwnProperty(itemQuestIName)) {
        inCommonQuestItems[itemQuestIName] = {};
      }

      var materialStealKey = "steal_" + materialListItem;
      if (inCommonQuestItems[itemQuestIName].hasOwnProperty(materialStealKey)) {
        console.warn('inCommonQuestItems Quest already has registered stealable item: ', itemQuestIName, materialStealKey);
      }

      var min = getTopLevelQuestItemParam(itemQuestIName, materialStealKey, 'min');
      var max = getTopLevelQuestItemParam(itemQuestIName, materialStealKey, 'max');
      var median = (min + max) / 2;

      inCommonQuestItems[itemQuestIName][materialStealKey] = {
        'dropChance': getTopLevelQuestItemParam(itemQuestIName, materialStealKey, 'dropChance'),
        'num': median,
        'type': 'steal',
      };
    });
  });

  var inCommonSorted = {};
  let sortedKeys = Object.keys(inCommonQuestItems).sort(function (a, b) {
    var commonSort = Object.keys(inCommonQuestItems[b]).length - Object.keys(inCommonQuestItems[a]).length;
    if (!requiredMaterial || commonSort !== 0) {
      return commonSort;
    }

    if (inCommonQuestItems[b].hasOwnProperty(requiredMaterial) && inCommonQuestItems[a].hasOwnProperty(requiredMaterial)) {
      var dropSort = inCommonQuestItems[b][requiredMaterial].dropChance - inCommonQuestItems[a][requiredMaterial].dropChance;
      if (dropSort !== 0) {
        return dropSort;
      }

      var numSort = inCommonQuestItems[b][requiredMaterial].num - inCommonQuestItems[a][requiredMaterial].num;
      if (numSort !== 0) {
        return numSort;
      }
    }

    return 0;
  });
  sortedKeys.forEach(function (key) {
    inCommonSorted[key] = inCommonQuestItems[key];
  });
  inCommonQuestItems = inCommonSorted;

  var $tbody = $('.quest-list tbody');
  $tbody.html('');

  for (let [questIName, matchedItems] of Object.entries(inCommonQuestItems)) {
    var questRowVM = {};

    var quest = loadedData['QuestsByIName'][questIName];
    if (!quest) {
      console.error("Unable to find quest for quest iname: ", questIName, quest);
      continue;
    }

    var startDate = '';
    var endDate = '';
    var dateStatus = 'current';
    var isCurrent = true;
    var isExpired = false;
    var isUpcoming = false;

    if (quest.start && quest.start > Date.now()) {
      dateStatus = 'upcoming';
      isUpcoming = true;
      isCurrent = false;
    }

    if (quest.end && quest.end < Date.now()) {
      dateStatus = 'expired';
      isExpired = true;
      isCurrent = false;
    }

    if (quest.start) {
      startDate = (new Date(quest.start)).toLocaleString();
    }

    if (quest.end) {
      endDate = (new Date(quest.end)).toLocaleString();
    }

    questRowVM.iname = questIName;
    questRowVM.type = quest.type;
    questRowVM.designation = quest.designation;
    questRowVM.title = quest.title.replace('<br>', ' ').replace('  ', ' ');
    questRowVM.numEnemies = quest.numEnemies;
    questRowVM.numChests = quest.numChests;
    questRowVM.nrg = quest.nrg;
    questRowVM.xp = quest.unitXp;
    questRowVM.jp = quest.jp;
    questRowVM.gold = quest.gold;
    questRowVM.start = startDate;
    questRowVM.end = endDate;
    questRowVM.dateStatus = dateStatus;
    questRowVM.isCurrent = isCurrent;
    questRowVM.isExpired = isExpired;
    questRowVM.isUpcoming = isUpcoming;

    questRowVM.materialDropBoxes = "";
    for (let [matchedItem, itemSortingParams] of Object.entries(matchedItems)) {
      var matchedItemVM = {};
      matchedItemVM.dropChance = quest.topLevelDrop[matchedItem].dropChance;
      matchedItemVM.dropboxClass = '';
      var isSteal = false;

      var matchedItemKey = matchedItem;
      if (quest.topLevelDrop[matchedItem].type === 'steal') {
        matchedItemKey = matchedItem.replace('steal_', '');
        matchedItemVM.dropboxClass += ' material-icon-drop-box-steal';
        isSteal = true;
      }

      if (requiredMaterial && (requiredMaterial === matchedItem || requiredMaterial === matchedItemKey)) {
        matchedItemVM.dropboxClass += ' material-icon-drop-box-required';
      }

      var entry = {
        'iname': matchedItemKey,
        'value': translation['ItemName'][matchedItemKey],
        'type': 'item',
        'min': quest.topLevelDrop[matchedItem].min,
        'max': quest.topLevelDrop[matchedItem].max,
      };
      matchedItemVM.materialLabel = getMaterialImageOrLabel(entry, false, true, isSteal);
      questRowVM.materialDropBoxes += applyTemplate('MaterialDropBox', matchedItemVM);
    }

    $tbody.append(applyTemplate('QuestRow', questRowVM));

    for (let [dropTableKey, setData] of Object.entries(quest.drop)) {
      if (!showStealable && setData.type === 'steal') {
        continue;
      }

      var questRowExpandedVM = {};
      questRowExpandedVM.iname = questIName;
      questRowExpandedVM.type = setData.type;
      questRowExpandedVM.isSteal = (setData.type === 'steal');
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

        matchedItemVM.materialLabel = getMaterialImageOrLabel(entry, false, true, questRowExpandedVM.isSteal);
        questRowExpandedVM.materialDropBoxes += applyTemplate('MaterialDropBox', matchedItemVM);
      });

      $tbody.append(applyTemplate('QuestRowExpanded', questRowExpandedVM));
    }
  }

  applyFiltering();

  $('#calculatingModal').modal('hide');
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

  requiredMaterial = null;

  updateQuestFilterInfo();
  updateLocalStorage();
}

/**
 * Stores the selected materials in local storage.
 */
function updateLocalStorage() {
  localStorage.setItem(version + '.selectedMaterials', JSON.stringify(materialsList));
  localStorage.setItem(version + '.filterOptions', JSON.stringify($('.quest-filters-form').serializeArray()));
  localStorage.setItem(version + '.requiredMaterial', requiredMaterial);
  localStorage.setItem(version + '.showStealable', showStealable);
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
  if (savedMaterials) {
    var list = JSON.parse(savedMaterials);
    if (list.length) {
      list.forEach(function (listItem) {
        registerMaterial(listItem);
      });
    }
  }

  requiredMaterial = localStorage.getItem(version + '.requiredMaterial');
  showStealable = (localStorage.getItem(version + '.showStealable') === 'true');
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
      registerMaterial(translation['ReverseLookup'][importMaterial]);
      return;
    }

    // Add material by item iname.
    // Only add material if it is a valid material we are tracking.
    // We can use ItemImageMap for this since even items without images are declared.
    if (!loadedData['ItemImageMap'].hasOwnProperty(importMaterial)) {
      return;
    }

    registerMaterial(importMaterial);
  });
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
  var itemQuestKeys = Object.keys(loadedData["ItemQuests"].drop);
  itemQuestKeys = itemQuestKeys.concat(loadedData["ItemQuests"].steal);

  // Build the structure for the autocomplete.
  itemQuestKeys.forEach(function (itemCode) {
    var entry = {
      'iname': itemCode,
      'value': translation['ItemName'][itemCode],
      'type': 'item',
    };
    entry.materialLabel = getMaterialImageOrLabel(entry, true, false, false);
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

  var $typeahead = $('.typeahead');

  $typeahead.typeahead({
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

  $typeahead.on('typeahead:select', onTypeaheadSelect);
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
    'MaterialStealLayer': '.template-material-steal-layer',
    'QuestFiltersInfo': '.template-quest-filters-info',
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
  $body.on('click', '.toggle-dark-mode', function () {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $body.addClass('dark-mode');
    localStorage.setItem('darkMode', '1');
  });

  $body.on('click', '.toggle-light-mode', function () {
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
  $body.on('click', '.materials-list .btn-close', null, deleteMaterial);
  $body.on('click', '.btn-clear-all', null, clearAll);
  $body.on('click', '.btn-export', null, populateExport);

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
    $('.typeahead').trigger('focus');
  });

  $body.on('click', '.nav-import', function (e) {
    e.preventDefault();
    $('.mode').hide();
    $('.mode-import').show();
    $('#import').trigger('focus');
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
    $('.autocomplete__input').trigger('focus');
  });

  $body.on('click', '.btn-import', function (e) {
    e.preventDefault();
    doImport($('#import').val());
    rebuildMaterialsDom();
    updateLocalStorage();
    calculateStart();
    $('.mode-autocomplete').show();
    $('.mode-import').hide();
    $('.nav-main a').removeClass('active');
    $('.nav-main a:first-child').addClass('active');
  });

  // Handle the "required material" click events.
  $body.on('click', '.required-material', function (e) {
    e.preventDefault();

    var $this = $(this);
    var alreadyEnabled = ($this.attr('src') === 'img/ui/summonquest_icon_rarelity_on.png');
    var $requiredMaterials = $('.required-material');
    $requiredMaterials.attr('src', 'img/ui/summonquest_icon_rarelity_off.png');
    $requiredMaterials.parent().removeClass('input-group-text-required');
    requiredMaterial = null;

    if (!alreadyEnabled) {
      requiredMaterial = $this.parents('.material-item-input').data('material');
      $this.attr('src', 'img/ui/summonquest_icon_rarelity_on.png');
      $this.parent().addClass('input-group-text-required');
    }

    updateLocalStorage();
    calculateStart();
  });

  // Handle toggling showing stealable items.
  $body.on('click', '#questStealShow', function (e) {
    showStealable = document.getElementById('questStealShow').checked;
    updateLocalStorage();
    calculateStart();
  });

  // Init calculating modal, but don't show yet.
  $('#calculatingModal').modal({
    'show': false
  });
}

/**
 * Attaches handlers and processes quest filter inputs.
 */
function initFiltering() {
  filterOptions.forEach(function (filterOption) {
    var $field = $('[name=' + filterOption.name + ']');
    if ($field[0].type === "radio" || $field[0].type === "checkbox") {
      var $fieldWithValue = $field.filter('[value="' + filterOption.value + '"]');
      var isFound = ($fieldWithValue.length > 0);
      if (!isFound && filterOption.value === "on") {
        $field.first().prop("checked", true);
      } else {
        $fieldWithValue.prop("checked", isFound);
      }
    } else { // input, textarea
      $field.val(filterOption.value);
    }
  });

  var $body = $('body');
  $body.on('click', '.quest-filters input[type=checkbox]', function () {
    applyFiltering();
  });

  $body.on('click', '.btn-filter-clear', function () {
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

  var $clearBtn = $('.btn-filter-clear');
  $clearBtn.hide();

  // Default all to hidden and then keep track of which rows to show.
  var $questRows = $('.quest-row').hide();

  // Filter on quest type.
  var $checkedTypes = $('.quest-type-checkboxes input[type=checkbox]:checked');
  if ($checkedTypes.length > 0) {
    $clearBtn.show();

    $checkedTypes.each(function (index, checkbox) {
      $questRows = $questRows.not('.quest-row-type-' + $(checkbox).val());
    });
  }

  // Filter on quest date expired/upcoming.
  var currentChecked = document.getElementById('questDateCurrent').checked;
  var expiredChecked = document.getElementById('questDateExpired').checked;
  var upcomingChecked = document.getElementById('questDateUpcoming').checked;

  if (currentChecked || expiredChecked || upcomingChecked) {
    $clearBtn.show();
  }

  if (currentChecked) {
    $questRows = $questRows.not('.quest-date-status-current');
  }

  if (!expiredChecked) {
    $questRows = $questRows.not('.quest-date-status-expired');
  }

  if (!upcomingChecked) {
    $questRows = $questRows.not('.quest-date-status-upcoming');
  }

  // @todo: add other types of filtering here.

  // Show any quests that passed the filtering.
  $questRows.show();

  updateQuestFilterInfo();
}

/**
 * Updates the quest filtering and sorting feedback text to make things a little
 * clearer on what's happening behind the scenes.
 */
function updateQuestFilterInfo() {
  var $questFiltersInfoContainer = $('.quest-filters-info-container');

  if (materialsList.length === 0) {
    $questFiltersInfoContainer.html('');
    return;
  }

  var filteredTypes = 'Showing all quest types.';
  var $checked = $('.quest-type-checkboxes input[type=checkbox]:checked');
  if ($checked.length > 0) {
    var checkedVals = [];
    $checked.each(function (index, checkbox) {
      checkedVals.push($(checkbox).val());
    });
    filteredTypes = 'Hiding quests of type: ' + checkedVals.join(', ') + '.';
  }

  var showDates = [];
  var hideDates = [];
  var currentChecked = document.getElementById('questDateCurrent').checked;
  var expiredChecked = document.getElementById('questDateExpired').checked;
  var upcomingChecked = document.getElementById('questDateUpcoming').checked;

  if (currentChecked) {
    hideDates.push('current');
  } else {
    showDates.push('current');
  }

  if (expiredChecked) {
    showDates.push('expired');
  } else {
    hideDates.push('expired');
  }

  if (upcomingChecked) {
    showDates.push('upcoming');
  } else {
    hideDates.push('upcoming');
  }

  var dateTypesShow = '';
  var dateTypesHide = '';
  if (showDates.length > 0) {
    dateTypesShow = 'Showing ' + showDates.join(' and ') + ' quests.';
  }

  if (hideDates.length > 0) {
    dateTypesHide = 'Hiding ' + hideDates.join(' and ') + ' quests.';
  }

  var filteredRequired = '';
  var sorted = '.';
  if (requiredMaterial) {
    filteredRequired = ' Only showing quests with the required material "' + translation['ItemName'][requiredMaterial] + '".';
    sorted = ', then by the required material\'s at-least-one drop chance, then by the required material\'s median drop quantity.';
  }

  var filteredSteal = '';
  var stealChecked = document.getElementById('questStealShow').checked;
  if (stealChecked) {
    filteredSteal = 'Showing stealable items.';
  }

  var html = applyTemplate('QuestFiltersInfo', {
    'filteredTypes': filteredTypes,
    'filteredRequired': filteredRequired,
    'sorted': sorted,
    'dateTypesHide': dateTypesHide,
    'dateTypesShow': dateTypesShow,
    'filteredSteal': filteredSteal
  });
  $questFiltersInfoContainer.html(html);
}

/**
 * Utility function to get a top level parameter that may/may not exist.
 *
 * @param itemQuestIName
 * @param materialListItem
 * @param param
 * @returns {number|*}
 */
function getTopLevelQuestItemParam(itemQuestIName, materialListItem, param) {
  if (!loadedData['QuestsByIName'].hasOwnProperty(itemQuestIName)) {
    console.warn('Attempted to get top level param for invalid quest: ', itemQuestIName, materialListItem, param);
    return 0;
  }

  if (!loadedData['QuestsByIName'][itemQuestIName].topLevelDrop.hasOwnProperty(materialListItem)) {
    console.warn('Attempted to get top level param for invalid material: ', itemQuestIName, materialListItem, param);
    return 0;
  }

  if (!loadedData['QuestsByIName'][itemQuestIName].topLevelDrop[materialListItem].hasOwnProperty(param)) {
    console.warn('Attempted to get top level param for invalid param: ', itemQuestIName, materialListItem, param);
    return 0;
  }

  return loadedData['QuestsByIName'][itemQuestIName].topLevelDrop[materialListItem][param];
}
