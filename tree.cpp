#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <list>
#include <vector>
#include <algorithm>
#include <numeric>

using std::list;
using std::string;
using std::runtime_error;

void replace_all_in_place(string &str, char target, char replacement) {
    for(size_t i=0; i<str.size(); ++i)
        if (str[i] == target) str[i] = replacement;
}

struct Tree {
    list<Tree> children;
    string name, name_prefix, name_id;
    int total_leaves, total_nodes;
    
    static int max_depth;
 
    Tree() :
        total_leaves(1), 
        total_nodes(1)
    {}
    
    void add_child(Tree child) {
        if (children.size() == 0) total_leaves = 0;
        
        children.push_back(child);
        total_leaves += child.total_leaves;
        total_nodes += child.total_nodes;
    }
 
    void set_name(string name_) {
        name = name_;
        
        int uscore_pos = name.find_last_of('_');
        
        name_prefix = name.substr(0,uscore_pos);
        replace_all_in_place(name_prefix, '_', ' ');
        name_id = name.substr(uscore_pos+1);
    }
};

int Tree::max_depth;

string read_newick_string(std::istream &is) {
    std::ostringstream oss;
    while (true) {
        char c = is.peek();
        if (c == ',' || c == ')' || c == ';' || is.eof()) return oss.str();
        oss << c;
        is.ignore();
    }
    throw runtime_error("unexpected eof");
}

Tree read_newick_tree(std::istream &is, int depth = 0) {
    
    if (depth == 0) Tree::max_depth = 0;
    
    Tree tree;
    
    if (Tree::max_depth < depth) Tree::max_depth = depth;
    
    if (is.peek() == '(') {
        is.ignore();
        while (true) {
            tree.add_child(read_newick_tree(is, depth+1));
            
            char c = is.get();
            if (c == ',') continue;
            if (c == ')') break;
            throw runtime_error("unexpected token "+string(1, c));
        }
    }
    
    tree.set_name(read_newick_string(is));
    
    if (depth == 0 && is.peek() == ';') is.ignore();
    return tree;
}

void write_json_str(std::ostream &os, const string &str) {
    os << "\"";
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '"') os << "\\\"";
        else os << str[i];
    }
    os << "\"";
}

void write_tree_json(const Tree& tree, std::ostream &os, bool root = true) {
    
    os << "{";
    const string &name = tree.name_prefix;
    
    if (name.size() > 0) {
        os << "\"n\":";
        write_json_str(os, name);
    }
    
    if (tree.children.size() > 0) {
        
        if (name.size() > 0) os << ',';
        
        os << "\"s\":" << tree.total_leaves;
        
        os << ",\"c\":[";
        list<Tree>::const_iterator itr = tree.children.begin();
        while(itr != tree.children.end()) {
            write_tree_json(*itr, os, false);
            itr++;
            if (itr != tree.children.end()) os << ',';
        }
        os << ']';
    }
    os << '}';
    if (root) os << std::endl;
}

int main() {
    Tree tree = read_newick_tree(std::cin);
    std::cerr << tree.name_prefix << std::endl;
    std::cerr << tree.total_leaves << " leaf nodes" << std::endl;
    std::cerr << tree.total_nodes << " nodes" << std::endl;
    std::cerr << Tree::max_depth << " max depth" << std::endl;
    
    write_tree_json(tree, std::cout);
}
