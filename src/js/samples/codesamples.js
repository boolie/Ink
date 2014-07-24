var sectionsWithSample = document.querySelectorAll('[data-ink-sample]');

for (var i = 0; i < sectionsWithSample.length; i++) {
    var sampleSubjects = sectionsWithSample[i].querySelectorAll('[data-subject], script');

    var sampleText = '';
    for (var j = 0; j < sampleSubjects.length; j++) {
        sampleSubjects[j].removeAttribute('data-subject')
        sampleText += sampleSubjects[j].outerHTML + '\n';
    };

    var codeSample = sectionsWithSample[i]
        .appendChild(document.createElement('pre'))
        .appendChild(document.createElement('code'));

    codeSample.parentNode.className = 'prettyprint linenums';
    codeSample.textContent = sampleText;
}
