/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Download Manager UI Test Code.
 *
 * The Initial Developer of the Original Code is
 * Edward Lee <edward.lee@engineering.uiuc.edu>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Test bug 431188 to make sure the Clear list button is enabled after doing a
 * search and finding results.
 */

function test()
{
  let dm = Cc["@mozilla.org/download-manager;1"].
           getService(Ci.nsIDownloadManager);
  let db = dm.DBConnection;

  // Empty any old downloads
  db.executeSimpleSQL("DELETE FROM moz_downloads");

  // Make a file name for the downloads
  let file = Cc["@mozilla.org/file/directory_service;1"].
             getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
  file.append("cleanUp");
  let filePath = Cc["@mozilla.org/network/io-service;1"].
                 getService(Ci.nsIIOService).newFileURI(file).spec;

  let stmt = db.createStatement(
    "INSERT INTO moz_downloads (target, source, state, endTime) " +
    "VALUES (?1, ?2, ?3, ?4)");

  // Add a bunch of downloads that don't match the search
  let sites = [];
  for (let i = 0; i < 50; i++)
    sites.push("i-hate.clear-list-" + i);

  // Add one download that matches the search
  let searchTerm = "one-download.match-search";
  sites.push(searchTerm);

  try {
    for each (let site in sites) {
      stmt.bindStringParameter(0, filePath);
      stmt.bindStringParameter(1, "http://" + site + "/file");
      stmt.bindInt32Parameter(2, dm.DOWNLOAD_FINISHED);
      // Make the one that matches slightly older so it appears last
      stmt.bindInt64Parameter(3, 1112223334445556 - (site == searchTerm));

      // Add it!
      stmt.execute();
    }
  }
  finally {
    stmt.reset();
    stmt.finalize();
  }

  // Close the UI if necessary
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
           getService(Ci.nsIWindowMediator);
  let win = wm.getMostRecentWindow("Download:Manager");
  if (win) win.close();

  let obs = Cc["@mozilla.org/observer-service;1"].
            getService(Ci.nsIObserverService);
  const DLMGR_UI_DONE = "download-manager-ui-done";

  let testPhase = 0;
  let testObs = {
    observe: function(aSubject, aTopic, aData) {
      if (aTopic != DLMGR_UI_DONE)
        return;

      let win = aSubject.QueryInterface(Ci.nsIDOMWindow);
      let $ = function(aId) win.document.getElementById(aId);
      let downloadView = $("downloadView");
      let searchbox = $("searchbox");
      let clearList = $("clearListButton");

      // The list must have built, so figure out what test to do
      switch (testPhase++) {
        case 0:
        case 2:
          // Search for the one download
          searchbox.value = searchTerm;
          searchbox.doCommand();

          break;
        case 1:
          // Search came back with 1 item
          is(downloadView.itemCount, 1, "Search found the item to delete");
          is(clearList.disabled, false, "Clear list is enabled for search matching 1 item");

          // Clear the list that has the single matched item
          clearList.doCommand();

          break;
        case 3:
          // There's nothing that matches the search
          is(downloadView.itemCount, 0, "Clear list killed the one matching download");
          is(clearList.disabled, true, "Clear list is disabled for no items");

          // We're done!
          obs.removeObserver(testObs, DLMGR_UI_DONE);
          finish();

          break;
      }
    }
  };
  obs.addObserver(testObs, DLMGR_UI_DONE, false);

  // Show the Download Manager UI
  Cc["@mozilla.org/download-manager-ui;1"].
  getService(Ci.nsIDownloadManagerUI).show();

  waitForExplicitFinish();
}
