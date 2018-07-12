var MEDIA_WIKI_API_ENDPOINT = 'http://ja.wikipedia.org/w/api.php';

var diffWorker = new Worker('/js/diff-worker.js');



document.addEventListener('DOMContentLoaded', function() {
	// var titles = '岩崎万次郎';
	var titles = 'AIBO';
	// var titles = 'サザンオールスターズ';


	// ページのIDを取得する
	var getPageID = function(titles) {
		var defer = $.Deferred();
		
		$.ajax({
			url: MEDIA_WIKI_API_ENDPOINT,
			type: 'GET',
			data: {
				'action': 'query',
				'format': 'json',
				'formatversion': 'latest',
				'utf8': 1,
				'titles': titles
			},
			dataType: 'jsonp',
			jsonpCallback: (function () {
				var callback = $.noop;
				return 'callback';
			})()
		})
		.done(function (data) {
			var pageid; // ページのID用の変数
			var pages = data.query.pages;

			// 検索結果が1件以上返ってきているか、かつ、
			// 検索結果1件目にpageidが存在するか
			if (pages.length >= 1 && data.query.pages[0].pageid) {
				// ページのIDが取得できた時の処理
				pageid = data.query.pages[0].pageid;
				console.log(titles + ' のページIDは ' + pageid + ' です');
			} else {
				// ページのIDが取得できなかった時の処理
				console.log(titles + ' に該当するのページIDを取得できませんでした');
			}

			defer.resolve({ 'pageid': pageid });
		})
		.fail(function (error) {
			console.log(error);
			defer.reject(error);
		});
	
		return defer.promise();
	}



	// ページのリビジョン（更新履歴）を取得する
	// keydata
	// keydata.pageid
	var getRevisions = function(keydata, options) {
		var defaults = {
			'revisions': [],
			'query': {
				'action': 'query',
				'prop': 'revisions',
				'rvlimit': 'max',
				'rvprop': 'ids|timestamp',
				'format': 'json',
				'formatversion': 'latest',
				'utf8': 1,
			}
		};

		var options = $.extend(true, {}, defaults, options);
		var query = $.extend(true, {}, options.query, { 'pageids': keydata.pageid });
		var defer = $.Deferred();

		$.ajax({
			'url': MEDIA_WIKI_API_ENDPOINT,
			'type': 'GET',
			'data': query,
			'dataType': 'jsonp',
			'jsonpCallback': (function () {
				var callback = $.noop;
				return 'callback';
			})()
		})
		.done(function (data) {
			var revisions = []; // ページのリビジョン（更新履歴）用の変数
			var pages = data.query.pages;

			// 検索結果が1件以上返ってきているか、かつ、
			// 検索結果1件目にrevisionsが存在するか
			if (pages.length >= 1 && data.query.pages[0].revisions) {
				// ページのリビジョン（更新履歴）が取得できた時の処理
				revisions = [].concat(options.revisions, data.query.pages[0].revisions);

				console.log(titles + ' (ID: ' + keydata.pageid + ') のリビジョンを ' + revisions.length + '件取得しました');

				// 取得したリビジョンの末尾のインデックスを取得する
				var endIndex = revisions.length - 1;
				// 取得したリビジョンの末尾の親リビジョンのIDを取得する
				var endParentRevisionID = revisions[endIndex].parentid;

				// 全てのリビジョンを取得できたかで分岐
				if (endParentRevisionID !== 0) {
					// 全てのリビジョンを取得できていない場合の処理
					// 最古のリビジョンIDは0となるので、0以外の場合は更にリビジョンを取得する
					getRevisions({
						'pageid': keydata.pageid,
					}, {
						'revisions': revisions,
						'query': {
							'rvstartid': endParentRevisionID
						}
					})
					.done(function(result){
						defer.resolve({
							'pageid': result.pageid,
							'revisions': result.revisions
						});
					});


				} else {
					// 全てのリビジョンを取得できた場合の処理
					// 状態をresolve にする
					defer.resolve({
						'pageid': keydata.pageid,
						'revisions': revisions
					});
				}
			} else {
				// ページのリビジョン（更新履歴）が取得できなかった時の処理
				console.log(titles + ' に該当するのページIDを取得できませんでした');
				defer.reject();
			}
		})
		.fail(function (error) {
			console.log(error);
			defer.reject(error);
		});

		return defer.promise();
	}



	// keydata
	// keydata.oldid
	var getContent = function(keydata, options) {
		var defaults = {
			'query': {
				'action': 'parse',
				'prop': 'text',
				'disablelimitreport': 1,
				'disableeditsection': 1,
				'disabletoc': 1,
				'format': 'json',
				'formatversion': 'latest',
				'utf8': 1
			},
			'struct': {}
		};

		var options = $.extend(true, {}, defaults, options);
		var query = $.extend(true, {}, options.query, { 'oldid': keydata.oldid });
		var defer = $.Deferred();

		$.ajax({
			'url': MEDIA_WIKI_API_ENDPOINT,
			'type': 'GET',
			'data': query,
			'dataType': 'jsonp',
			'jsonpCallback': (function () {
				var callback = $.noop;
				return 'callback';
			})()
		})
		.done(function (data) {
			console.log(titles + ' (ID: ' + keydata.pageId + ', Revision ID:' + keydata.oldid + ') のHTMLを取得しました');

			var result = {};

			result.pageid = data.parse.pageid;
			result.revid = data.parse.pageid;
			result.text = data.parse.text;
			result.struct = options.struct;

			defer.resolve(result);
		})
		.fail(function (error) {
			console.log(error);
			defer.reject(error);
		});

		return defer.promise();
	}


	var goBackToTheFuture = function(keydata) {
		var revisionIndex = 0;
		var pageId = keydata.pageid;
		var revisions = keydata.revisions;
		var limit = revisions.length - 1;

		var revisionId = revisions[revisionIndex].revid;
		var revisionTimestamp = revisions[revisionIndex].timestamp;

		
		getContent({
			'pageId': pageId,
			'oldid': revisionId
		}, {
			'struct': {
				'timestamp': revisionTimestamp
			}
		}).then(function(content) {
			
			return (function goBack(content) {
				++revisionIndex;
				if (revisionIndex > limit) return;

				var parentRevisionId = revisions[revisionIndex].revid;
				var parentRevisionTimestamp = revisions[revisionIndex].timestamp;

				getContent({
					'pageId': pageId,
					'oldid': parentRevisionId
				}, {
					'struct': {
						'timestamp': parentRevisionTimestamp
					}
				}).then(function(parentContent) {
					var text = content.text;
					var parentText = parentContent.text;

					var onMessage = function(e) {
						diffWorker.removeEventListener('message', onMessage, false);
						$('body').html(e.data);
						goBack(parentContent);
					};

					diffWorker.addEventListener('message', onMessage, false);

					diffWorker.postMessage({
						'text': text,
						'parentText': parentText
					});

					// var html = htmldiff(text, parentText);

					// $('body').html(html);

					// goBack(parentContent);
				});

			})(content);
		
		});
	};


// //処理結果、受信イベント
//   worker.addEventListener('message', function(e) {
//     $("#idParamReceive").val(e.data);
//   }, false);

//   //処理命令
//   worker.postMessage($("#idParamPost").val());


	getPageID(titles)
		.then(getRevisions)
		.then(function(result) {
			goBackToTheFuture(result);
		});
}, false);














































